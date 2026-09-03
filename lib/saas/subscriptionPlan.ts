/**
 * Customer Subscription Self-Service plan-switch workflow.
 *
 * A customer (org contact) requests a plan change on their own subscription.
 * The request is stored on the EXISTING PlanChangeRequest model (action =
 * "subscription_change"), reusing that single approval-home table rather than
 * inventing a parallel one. A billing admin (SUBSCRIPTION_MANAGE) approves or
 * rejects; approval executes the canonical changePlan() against the target
 * subscription — every business rule (market price re-resolve, negotiated
 * carry-over, proration invoice, MRR sync, audit) lives in the shared service.
 *
 * Guarantees:
 * - Tenant isolation: requests are always scoped to the caller's organizationId.
 * - Duplicate prevention: one open request per subscription (409).
 * - Idempotent decisions: atomic claim updateMany so two reviewers cannot both
 *   apply; losers get 409 without side effects.
 * - Every decision audited + org notified.
 */
import { prisma } from "@/lib/prisma";
import {
  changePlan,
  resolveSubscriptionPrice,
  prorationDeltaMinor,
  getSubscription,
} from "@/lib/saas/subscriptions";
import { writeSaasAudit } from "@/lib/saas/audit";
import { hasSaasPerm } from "@/lib/saas/roles";
import { pushNotificationToOrg } from "@/lib/saas/notifications";
import type { AuthUser } from "@/lib/auth";

/** States from which a plan switch is allowed. Suspended/cancelled/expired are not. */
const SWITCHABLE = ["trial", "active", "past_due", "grace", "paused"] as const;

const REVENUE_SWITCHABLE = ["active", "past_due", "grace"] as const;

export interface ChangePreview {
  toPlanId: string;
  toPlanName: string;
  currency: string;
  currentUnitAmount: number | null;
  newUnitAmount: number | null;
  billingCycle: "monthly" | "yearly";
  prorationDeltaMinor: number;
  custom?: boolean;
}

/**
 * Preview a plan switch exactly the way canonical changePlan() will execute it:
 * mirror its negotiated-amount carry-over decision, then resolve the target
 * market price and compute the mid-period proration delta.
 */
export async function previewSubscriptionChange(input: {
  organizationId: string;
  subscriptionId: string;
  toPlanId: string;
  billingCycle?: "monthly" | "yearly";
}): Promise<ChangePreview> {
  const cycle = input.billingCycle ?? undefined;
  const sub = await getSubscription(input.subscriptionId);
  if (!sub || sub.organizationId !== input.organizationId) {
    throw new Error("Subscription not found");
  }
  if (!(SWITCHABLE as readonly string[]).includes(sub.status)) {
    throw new Error(`Cannot change plan while subscription is "${sub.status}"`);
  }
  if (sub.planId === input.toPlanId && (cycle === undefined || cycle === sub.billingCycle)) {
    throw new Error("Subscription is already on this plan");
  }
  const plan = await prisma.plan.findUnique({ where: { id: input.toPlanId } });
  if (!plan || !plan.isActive || plan.archivedAt) throw new Error("Target plan is not available");

  const targetCycle = (cycle ?? sub.billingCycle) as "monthly" | "yearly";

  // Mirror changePlan's negotiated-pricing carry-over for the preview.
  let unitAmountOverride: number | null | undefined;
  if (targetCycle === sub.billingCycle && sub.unitAmount != null) {
    const currentCatalog = await resolveSubscriptionPrice({
      planId: sub.planId,
      country: sub.country,
      billingCycle: targetCycle,
      unitAmountOverride: null,
    }).catch(() => null);
    const negotiated = !currentCatalog || currentCatalog.unitAmount !== sub.unitAmount;
    unitAmountOverride = negotiated ? sub.unitAmount : null;
  }
  let price;
  try {
    price = await resolveSubscriptionPrice({
      planId: input.toPlanId,
      country: sub.country,
      billingCycle: targetCycle,
      unitAmountOverride,
    });
  } catch (err: unknown) {
    if (plan.isCustomPrice) {
      price = { country: sub.country, currency: sub.currency, unitAmount: sub.unitAmount, custom: true };
    } else {
      throw err;
    }
  }

  let delta = 0;
  if (
    (REVENUE_SWITCHABLE as readonly string[]).includes(sub.status) &&
    sub.unitAmount != null &&
    price.unitAmount != null &&
    sub.currency === price.currency &&
    sub.currentPeriodStart &&
    sub.currentPeriodEnd
  ) {
    delta = prorationDeltaMinor({
      oldUnitAmount: sub.unitAmount,
      newUnitAmount: price.unitAmount,
      oldCycle: sub.billingCycle as "monthly" | "yearly",
      newCycle: targetCycle,
      periodStartMs: sub.currentPeriodStart.getTime(),
      periodEndMs: sub.currentPeriodEnd.getTime(),
      nowMs: Date.now(),
    });
  }

  return {
    toPlanId: plan.id,
    toPlanName: plan.name,
    currency: price.currency,
    currentUnitAmount: sub.unitAmount,
    newUnitAmount: price.unitAmount,
    billingCycle: targetCycle,
    prorationDeltaMinor: delta,
    custom: price.custom,
  };
}

export type RequestSubscriptionChangeResult =
  | { ok: true; requestId: string }
  | { ok: false; status: number; error: string };

/** Create a pending subscription plan-switch request (customer-facing). */
export async function requestSubscriptionChange(opts: {
  organizationId: string;
  subscriptionId: string;
  toPlanId: string;
  billingCycle?: "monthly" | "yearly";
  requestedByEmail: string;
  requestedByUserId?: string;
  ip?: string | null;
  reason?: string;
}): Promise<RequestSubscriptionChangeResult> {
  try {
    const sub = await getSubscription(opts.subscriptionId);
    if (!sub || sub.organizationId !== opts.organizationId) {
      return { ok: false, status: 404, error: "Subscription not found" };
    }
    if (!(SWITCHABLE as readonly string[]).includes(sub.status)) {
      return { ok: false, status: 409, error: `Cannot change plan while subscription is "${sub.status}"` };
    }
    const cycle = opts.billingCycle ?? undefined;
    if (sub.planId === opts.toPlanId && (cycle === undefined || cycle === sub.billingCycle)) {
      return { ok: false, status: 409, error: "Subscription is already on this plan" };
    }
    if (cycle !== undefined && cycle !== "monthly" && cycle !== "yearly") {
      return { ok: false, status: 400, error: "billingCycle must be monthly|yearly" };
    }

    const preview = await previewSubscriptionChange(opts);
    void preview;

    const plan = await prisma.plan.findUnique({ where: { id: opts.toPlanId } });
    if (!plan || !plan.isActive || plan.archivedAt) {
      return { ok: false, status: 400, error: "Target plan is not available" };
    }

    // Duplicate prevention: one open request per subscription.
    const open = await prisma.planChangeRequest.findFirst({
      where: { subscriptionId: opts.subscriptionId, action: "subscription_change", status: "pending" },
      select: { id: true },
    });
    if (open) {
      return { ok: false, status: 409, error: "A plan-change request is already pending for this subscription" };
    }

    const req = await prisma.planChangeRequest.create({
      data: {
        action: "subscription_change",
        status: "pending",
        requestedByEmail: opts.requestedByEmail.trim().toLowerCase(),
        organizationId: opts.organizationId,
        subscriptionId: opts.subscriptionId,
        fromPlanId: sub.planId,
        toPlanId: opts.toPlanId,
        billingCycle: cycle ?? null,
        reason: opts.reason?.trim() || null,
        baseVersion: 0,
        beforeSnapshot: {
          fromPlanId: sub.planId,
          billingCycle: sub.billingCycle,
          unitAmount: sub.unitAmount,
          currency: sub.currency,
        },
        proposedSnapshot: {
          toPlanId: preview.toPlanId,
          billingCycle: preview.billingCycle,
          unitAmount: preview.newUnitAmount,
          currency: preview.currency,
          prorationDeltaMinor: preview.prorationDeltaMinor,
        },
      },
    });
    await writeSaasAudit({
      byEmail: opts.requestedByEmail,
      actorId: opts.requestedByUserId,
      action: "subscription.change_requested",
      entity: "subscription_request",
      entityId: req.id,
      detail: `plan switch ${sub.planId}→${opts.toPlanId} (${preview.billingCycle}) for org ${opts.organizationId}`,
      ip: opts.ip ?? undefined,
      before: { planId: sub.planId, billingCycle: sub.billingCycle },
      after: { planId: opts.toPlanId, billingCycle: preview.billingCycle, prorationDeltaMinor: preview.prorationDeltaMinor },
    });
    return { ok: true, requestId: req.id };
  } catch (e) {
    return { ok: false, status: 400, error: e instanceof Error ? e.message : "Request failed" };
  }
}

export interface DecisionResult {
  ok: boolean;
  status: number;
  error?: string;
}

function assertBillingAdmin(reviewer: Pick<AuthUser, "email" | "role">): string | null {
  return hasSaasPerm(reviewer, "SUBSCRIPTION_MANAGE") ? null : "SUBSCRIPTION_MANAGE required";
}

/** Approve a customer subscription plan switch — executes canonical changePlan(). */
export async function approveSubscriptionChange(
  requestId: string,
  reviewer: Pick<AuthUser, "email" | "role">,
  ip?: string | null,
): Promise<DecisionResult> {
  const permErr = assertBillingAdmin(reviewer);
  if (permErr) return { ok: false, status: 403, error: permErr };
  const req = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "request not found" };
  if (req.action !== "subscription_change") return { ok: false, status: 409, error: "not a subscription change request" };
  if (!req.subscriptionId) return { ok: false, status: 409, error: "request has no subscription" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Request already ${req.status}` };

  // Atomic claim BEFORE any side effect — exactly one reviewer applies.
  const claim = await prisma.planChangeRequest.updateMany({
    where: { id: req.id, status: "pending", action: "subscription_change" },
    data: { status: "approved", reviewedByEmail: reviewer.email.toLowerCase(), reviewedAt: new Date() },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Request already decided by another reviewer" };

  try {
    const toPlanId = req.toPlanId;
    if (!toPlanId) throw new Error("request has no target plan");
    // Re-validate state at apply time: the sub must still be switchable.
    const sub = await getSubscription(req.subscriptionId);
    if (!sub) throw new Error("Subscription not found");
    if (!(SWITCHABLE as readonly string[]).includes(sub.status)) {
      throw new Error(`Subscription is now "${sub.status}" and cannot change plan`);
    }
    const cycle = (req.billingCycle as "monthly" | "yearly" | null) ?? undefined;
    await changePlan(req.subscriptionId, toPlanId, cycle, reviewer.email);
  } catch (e) {
    // Release the claim so the decision can be retried after fixing the cause.
    await prisma.planChangeRequest
      .updateMany({
        where: { id: req.id, status: "approved", reviewedByEmail: reviewer.email.toLowerCase() },
        data: { status: "pending", reviewedByEmail: null, reviewedAt: null },
      })
      .catch(() => {});
    return { ok: false, status: 400, error: e instanceof Error ? e.message : "apply failed" };
  }

  await writeSaasAudit({
    byEmail: reviewer.email,
    action: "subscription.change_approved",
    entity: "subscription_request",
    entityId: req.id,
    detail: `plan switch approved ${req.fromPlanId}→${req.toPlanId}`,
    ip: ip ?? undefined,
    before: req.beforeSnapshot,
    after: req.proposedSnapshot,
  });
  await pushNotificationToOrg({
    organizationId: req.organizationId!,
    kind: "subscription",
    title: "Plan change approved",
    body: `Your plan change to ${req.toPlanId} was approved and applied.`,
    href: "/customer/subscription",
  }).catch(() => {});
  return { ok: true, status: 200 };
}

export async function rejectSubscriptionChange(
  requestId: string,
  reviewer: Pick<AuthUser, "email" | "role">,
  reason: string,
  ip?: string | null,
): Promise<DecisionResult> {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) return { ok: false, status: 400, error: "Rejection reason is required" };
  const permErr = assertBillingAdmin(reviewer);
  if (permErr) return { ok: false, status: 403, error: permErr };
  const req = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "request not found" };
  if (req.action !== "subscription_change") return { ok: false, status: 409, error: "not a subscription change request" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Request already ${req.status}` };
  const claim = await prisma.planChangeRequest.updateMany({
    where: { id: req.id, status: "pending", action: "subscription_change" },
    data: { status: "rejected", reviewedByEmail: reviewer.email.toLowerCase(), reviewedAt: new Date(), rejectionReason: trimmed },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Request already decided by another reviewer" };
  await writeSaasAudit({
    byEmail: reviewer.email,
    action: "subscription.change_rejected",
    entity: "subscription_request",
    entityId: req.id,
    detail: `plan switch rejected: ${trimmed}`,
    ip: ip ?? undefined,
    before: req.beforeSnapshot,
    after: req.proposedSnapshot,
  });
  await pushNotificationToOrg({
    organizationId: req.organizationId!,
    kind: "subscription",
    title: "Plan change not approved",
    body: `Your plan change request was not approved: ${trimmed}`,
    href: "/customer/subscription",
  }).catch(() => {});
  return { ok: true, status: 200 };
}

/** Requester (customer) can withdraw their own pending request. */
export async function cancelSubscriptionChange(
  requestId: string,
  user: { email: string; userId?: string },
  ip?: string | null,
): Promise<DecisionResult> {
  const req = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "request not found" };
  if (req.action !== "subscription_change") return { ok: false, status: 409, error: "not a subscription change request" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Request already ${req.status}` };
  if (req.requestedByEmail !== user.email.trim().toLowerCase()) {
    return { ok: false, status: 403, error: "Only the requester can withdraw this request" };
  }
  const claim = await prisma.planChangeRequest.updateMany({
    where: { id: req.id, status: "pending", action: "subscription_change" },
    data: { status: "cancelled" },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Request already decided by another reviewer" };
  await writeSaasAudit({
    byEmail: user.email,
    actorId: user.userId,
    action: "subscription.change_cancelled",
    entity: "subscription_request",
    entityId: req.id,
    detail: "plan switch request withdrawn by requester",
    ip: ip ?? undefined,
  });
  return { ok: true, status: 200 };
}

/** Open request for a subscription (duplicate-prevention helper + panel). */
export async function openSubscriptionChangeFor(subscriptionId: string) {
  return prisma.planChangeRequest.findFirst({
    where: { subscriptionId, action: "subscription_change", status: "pending" },
  });
}

/** Subscription-change requests belonging to an organization (customer panel). */
export async function listSubscriptionChangesForOrg(organizationId: string) {
  return prisma.planChangeRequest.findMany({
    where: { organizationId, action: "subscription_change" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** All subscription-change requests across orgs (admin approval panel). */
export async function listSubscriptionChangeRequests(opts?: { status?: string; take?: number }) {
  return prisma.planChangeRequest.findMany({
    where: { action: "subscription_change", ...(opts?.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 100,
  });
}
