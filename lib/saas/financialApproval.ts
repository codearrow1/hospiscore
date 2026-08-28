/**
 * SaaS Financial Approval — Four-eyes / dual-approval control (Phase I).
 *
 * A high-risk financial action (invoice void, payment refund, payout release)
 * that should be reviewed by an INDEPENDENT approver can be routed through this
 * framework:
 *
 *   Requester ──request──▶ PENDING ──approve──▶ EXECUTING ──▶ EXECUTED
 *                                 └──reject──▶ REJECTED
 *                                 └──expire──▶ EXPIRED
 *                                 └──cancel──▶ CANCELLED (requester only)
 *
 * Server-enforced guarantees:
 *  - REQUESTER ≠ APPROVER. Self-approval is impossible server-side (403).
 *  - The approver needs a distinct approval permission (FINANCIAL_APPROVE);
 *    the requester needs the action's own execution permission.
 *  - The request carries an immutable SNAPSHOT (amount, currency, target state).
 *    Approval re-validates the snapshot against the CURRENT target state and
 *    BLOCKS if amount, currency or target status changed materially.
 *  - Duplicate pending requests for the same logical action are rejected.
 *  - Decision is a compare-and-swap atomic claim — two concurrent approvers can
 *    never both execute.
 *  - Execution delegates to the CANONICAL financial service (voidInvoice /
 *    refundPayment / updatePayoutStatus). Those services remain the sole
 *    authority and are themselves idempotent, so a retried execute cannot
 *    double-apply.
 *
 * The threshold policy (which actions require approval, and at what amount) is
 * configurable in SystemSetting ("financial_controls") and evaluated
 * deterministically by requiresApproval().
 */
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";
import { writeSaasAudit } from "./audit";
import { hasSaasPerm } from "./roles";
import type { SaasPermission } from "./roles";
import { pushNotification } from "./notifications";

/* ------------------------------------------------------------------------- */
/* Types                                                                       */
/* ------------------------------------------------------------------------- */

export type FinancialActionType = "invoice.void" | "payment.refund" | "payout.release";

export type FinancialApprovalStatus =
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "failed"
  | "rejected"
  | "cancelled"
  | "expired";

export const FINANCIAL_STATES: FinancialApprovalStatus[] = [
  "pending", "approved", "executing", "executed", "failed", "rejected", "cancelled", "expired",
];

/** Permission required to REQUEST (i.e. to perform) each action. */
const ACTION_EXEC_PERM: Record<FinancialActionType, SaasPermission> = {
  "invoice.void": "BILLING_MANAGE",
  "payment.refund": "REFUND_APPROVE",
  "payout.release": "AFFILIATE_PAYOUT",
};

/** Human label per action type (for UI + audit). */
export const ACTION_LABELS: Record<FinancialActionType, string> = {
  "invoice.void": "Invoice void",
  "payment.refund": "Payment refund",
  "payout.release": "Payout release",
};

const SETTINGS_KEY = "financial_controls";

export interface FinancialControlRule {
  mode: "always_four_eyes" | "threshold" | "off";
  /** Minor-unit threshold (inclusive) above which approval is required when mode=threshold. */
  thresholdMinor?: number;
}

export interface FinancialControlsSettings {
  enabled: boolean;
  expirationHours: number;
  actions: Partial<Record<FinancialActionType, FinancialControlRule>>;
}

const DEFAULT_SETTINGS: FinancialControlsSettings = {
  enabled: true,
  expirationHours: 72,
  actions: {
    "invoice.void": { mode: "always_four_eyes" },
    "payment.refund": { mode: "threshold", thresholdMinor: 1_000_00 }, // ₹10,000 in minor units
    "payout.release": { mode: "always_four_eyes" },
  },
};

/** What policy requires for a concrete action + amount. */
export interface PolicyResolution {
  approvalRequired: boolean;
  rule: FinancialControlRule | null | undefined;
}

export function isFinancialActionType(v: string): v is FinancialActionType {
  return v === "invoice.void" || v === "payment.refund" || v === "payout.release";
}

/* ------------------------------------------------------------------------- */
/* Settings / policy (deterministic)                                          */
/* ------------------------------------------------------------------------- */

export async function getFinancialControlsSettings(): Promise<FinancialControlsSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row?.value) return structuredClone(DEFAULT_SETTINGS);
  return { ...structuredClone(DEFAULT_SETTINGS), ...(row.value as Partial<FinancialControlsSettings>) };
}

export async function saveFinancialControlsSettings(
  value: FinancialControlsSettings,
  actorEmail: string,
): Promise<FinancialControlsSettings> {
  const normalized: FinancialControlsSettings = {
    enabled: value.enabled !== false,
    expirationHours: Number.isFinite(value.expirationHours) ? Math.max(1, Math.round(value.expirationHours)) : DEFAULT_SETTINGS.expirationHours,
    actions: value.actions ?? DEFAULT_SETTINGS.actions,
  };
  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: normalized as never, updatedByEmail: actorEmail, updatedAt: new Date() },
    update: { value: normalized as never, updatedByEmail: actorEmail, updatedAt: new Date() },
  });
  await writeSaasAudit({
    byEmail: actorEmail,
    action: "financial.settings_updated",
    entity: "financial_approval",
    detail: "financial approval controls updated",
    after: normalized as never,
  });
  return normalized;
}

/** Deterministic policy resolution — never hardcoded threshold values. */
export async function resolveFinancialPolicy(
  actionType: FinancialActionType | string,
  amountMinor: number,
): Promise<PolicyResolution> {
  const settings = await getFinancialControlsSettings();
  if (!settings.enabled) return { approvalRequired: false, rule: null };
  if (!isFinancialActionType(actionType)) return { approvalRequired: false, rule: null };
  const rule = settings.actions[actionType];
  if (!rule || rule.mode === "off") return { approvalRequired: false, rule };
  if (rule.mode === "always_four_eyes") return { approvalRequired: true, rule };
  // threshold
  const threshold = rule.thresholdMinor ?? DEFAULT_SETTINGS.actions[actionType]?.thresholdMinor ?? 0;
  return { approvalRequired: amountMinor >= threshold, rule };
}

/** Convenience used by revised endpoints: does this action need four-eyes? */
export async function requiresApproval(actionType: string, amountMinor: number): Promise<boolean> {
  return (await resolveFinancialPolicy(actionType, amountMinor)).approvalRequired;
}

/* ------------------------------------------------------------------------- */
/* Target read / validate / execute per action type                            */
/* ------------------------------------------------------------------------- */

interface TargetState {
  amountMinor: number;
  currency: string;
  status: string;
  organizationId: string | null;
  detail: Record<string, unknown>;
}

type TargetLoader = (targetId: string) => Promise<TargetState | null>;
type TargetValidator = (state: TargetState) => string | null; // returns blocking issue or null
type TargetExecutor = (targetId: string, actorEmail: string) => Promise<unknown>;

const TARGET_LIST: Record<FinancialActionType, { targetType: string; load: TargetLoader; validate: TargetValidator; execute: TargetExecutor }> = {
  "invoice.void": {
    targetType: "invoice",
    async load(id) {
      const inv = await prisma.invoice.findUnique({ where: { id }, select: { amount: true, currency: true, status: true, organizationId: true } });
      if (!inv) return null;
      return { amountMinor: inv.amount, currency: inv.currency, status: inv.status, organizationId: inv.organizationId, detail: { status: inv.status } };
    },
    validate(state) {
      if (state.status === "void" || state.status === "voided") return "Invoice is already void";
      if (state.status === "paid") return "Paid invoices must be refunded, not voided";
      if (!["issued", "past_due", "partially_paid"].includes(state.status)) return `Invoice cannot be voided in state "${state.status}"`;
      return null;
    },
    async execute(id, actorEmail) {
      const { voidInvoice } = await import("./gateway");
      return voidInvoice(id, actorEmail);
    },
  },
  "payment.refund": {
    targetType: "payment",
    async load(id) {
      const pay = await prisma.payment.findUnique({ where: { id }, select: { amount: true, currency: true, status: true, organizationId: true } });
      if (!pay) return null;
      return { amountMinor: pay.amount, currency: pay.currency, status: pay.status, organizationId: pay.organizationId, detail: { status: pay.status } };
    },
    validate(state) {
      if (state.status === "refunded") return "Payment is already refunded";
      if (state.status !== "succeeded") return `Only succeeded payments are refundable (payment is ${state.status})`;
      return null;
    },
    async execute(id, actorEmail) {
      const { refundPayment } = await import("./gateway");
      return refundPayment(id, actorEmail);
    },
  },
  "payout.release": {
    targetType: "payout",
    async load(id) {
      const out = await prisma.affiliatePayout.findUnique({ where: { id }, select: { amount: true, currency: true, status: true, affiliateId: true, partnerId: true } });
      if (!out) return null;
      return { amountMinor: out.amount, currency: out.currency, status: out.status, organizationId: null, detail: { status: out.status } };
    },
    validate(state) {
      // Canonical state machine: processing → paid is the ONLY legal settlement
      // transition. Releasing to `paid` from any other state cannot execute, so
      // only `processing` payouts may be routed through four-eyes release.
      if (state.status !== "processing") return `Payout can only be released from "processing" (currently "${state.status}")`;
      return null;
    },
    async execute(id, actorEmail) {
      const { updatePayoutStatus } = await import("./payouts");
      const saved = await updatePayoutStatus(id, "paid");
      await writeSaasAudit({ byEmail: actorEmail, action: "payout.released", entity: "payout", entityId: id, detail: "released via financial approval" });
      return saved;
    },
  },
};

function targetTypeFor(actionType: FinancialActionType): string {
  return TARGET_LIST[actionType].targetType;
}

/** Re-validate a snapshot against the current target state. Returns blocking issues. */
export interface RevalidationResult {
  ok: boolean;
  issues: string[];
  current: TargetState | null;
}

export async function revalidateTarget(approval: {
  actionType: FinancialActionType;
  targetId: string;
  amountMinor: number;
  currency: string;
  snapshot: Record<string, unknown>;
}): Promise<RevalidationResult> {
  const issues: string[] = [];
  const loader = TARGET_LIST[approval.actionType]?.load;
  if (!loader) return { ok: false, issues: ["Unsupported action type"], current: null };
  const current = await loader(approval.targetId);
  if (!current) {
    return { ok: false, issues: ["Target no longer exists"], current: null };
  }
  if (current.amountMinor !== approval.amountMinor) {
    issues.push(`Amount changed — requested ${approval.amountMinor}, current ${current.amountMinor}`);
  }
  if ((current.currency || "USD") !== (approval.currency || "USD")) {
    issues.push(`Currency changed — requested ${approval.currency}, current ${current.currency}`);
  }
  const stateIssue = TARGET_LIST[approval.actionType].validate(current);
  if (stateIssue) issues.push(stateIssue);
  return { ok: issues.length === 0, issues, current };
}

/* ------------------------------------------------------------------------- */
/* Errors                                                                      */
/* ------------------------------------------------------------------------- */

export class FinancialApprovalError extends Error {}

/* ------------------------------------------------------------------------- */
/* Request                                                                     */
/* ------------------------------------------------------------------------- */

export type FinancialApprovalResult =
  | { ok: true; approvalId: string; approvalRequired: boolean }
  | { ok: false; status: number; error: string };

export async function requestFinancialApproval(input: {
  actionType: FinancialActionType;
  targetId: string;
  reason?: string;
  requester: Pick<AuthUser, "email" | "role">;
  requesterUserId?: string;
  ip?: string | null;
}): Promise<FinancialApprovalResult> {
  try {
    const actionType = input.actionType;
    if (!isFinancialActionType(actionType)) return { ok: false, status: 400, error: "Unsupported action type" };

    // Requester must hold the action's execution permission.
    const execPerm = ACTION_EXEC_PERM[actionType];
    if (!hasSaasPerm(input.requester, execPerm)) {
      return { ok: false, status: 403, error: `${execPerm} required to request this action` };
    }

    const loader = TARGET_LIST[actionType].load;
    const target = await loader(input.targetId);
    if (!target) return { ok: false, status: 404, error: "Target not found" };

    const snapshot: Record<string, unknown> = {
      targetType: targetTypeFor(actionType),
      targetId: input.targetId,
      amountMinor: target.amountMinor,
      currency: target.currency || "USD",
      status: target.status,
      detail: target.detail,
    };

    // Duplicate pending request for the same logical action + target.
    const dup = await prisma.financialApproval.findFirst({
      where: { actionType, targetId: input.targetId, status: "pending" },
      select: { id: true },
    });
    if (dup) return { ok: false, status: 409, error: "A pending approval already exists for this action" };

    const policy = await resolveFinancialPolicy(actionType, target.amountMinor);
    const settings = await getFinancialControlsSettings();
    const expiresAt = new Date(Date.now() + settings.expirationHours * 3_600_000);

    const approval = await prisma.financialApproval.create({
      data: {
        actionType,
        targetType: targetTypeFor(actionType),
        targetId: input.targetId,
        amountMinor: target.amountMinor,
        currency: target.currency || "USD",
        organizationId: target.organizationId,
        requesterEmail: input.requester.email.trim().toLowerCase(),
        requesterUserId: input.requesterUserId || null,
        status: "pending",
        reason: input.reason?.trim() || null,
        expiresAt,
        snapshot: snapshot as never,
      },
    });

    await writeSaasAudit({
      byEmail: input.requester.email,
      actorId: input.requesterUserId,
      action: "financial.approval_requested",
      entity: "financial_approval",
      entityId: approval.id,
      detail: `${actionType} ${(target.amountMinor / 100).toFixed(2)} ${snapshot.currency} target ${input.targetId}`,
      ip: input.ip ?? undefined,
      before: { policy: policy.approvalRequired, targetId: input.targetId },
      after: snapshot,
    });

    // Best-effort notification to the org (approvers are platform admins; org
    // contacts are the requester-side audience). Notifications are passive.
    if (target.organizationId) {
      const { pushNotificationToOrg } = await import("./notifications");
      await pushNotificationToOrg({
        organizationId: target.organizationId,
        kind: "financial",
        title: "Financial approval requested",
        body: `${ACTION_LABELS[actionType]} of ${(target.amountMinor / 100).toFixed(2)} ${snapshot.currency} needs review.`,
        href: "/saas/financial-approvals",
      }).catch(() => {});
    }

    return { ok: true, approvalId: approval.id, approvalRequired: policy.approvalRequired };
  } catch (e) {
    if (e instanceof FinancialApprovalError) return { ok: false, status: 400, error: e.message };
    return { ok: false, status: 400, error: e instanceof Error ? e.message : "Request failed" };
  }
}

/* ------------------------------------------------------------------------- */
/* Approve                                                                    */
/* ------------------------------------------------------------------------- */

export interface DecisionResult {
  ok: boolean;
  status: number;
  error?: string;
  executed?: boolean;
}

export async function approveFinancialApproval(
  requestId: string,
  approver: Pick<AuthUser, "email" | "role">,
  ip?: string | null,
): Promise<DecisionResult> {
  // 1. approver must hold the approval permission
  if (!hasSaasPerm(approver, "FINANCIAL_APPROVE")) {
    return { ok: false, status: 403, error: "FINANCIAL_APPROVE required" };
  }
  const req = await prisma.financialApproval.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "Approval not found" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Approval already ${req.status}` };

  // 2. requester ≠ approver (self-approval is forbidden server-side)
  if (req.requesterEmail === approver.email.trim().toLowerCase()) {
    return { ok: false, status: 403, error: "Self-approval is not allowed: the approver must differ from the requester" };
  }

  // 3. expiry
  if (req.expiresAt && req.expiresAt.getTime() <= Date.now()) {
    await markExpired(req.id, ip);
    return { ok: false, status: 409, error: "Approval expired" };
  }

  const actionType = req.actionType as FinancialActionType;
  if (!isFinancialActionType(actionType)) return { ok: false, status: 409, error: "Unsupported action type" };

  // 4. snapshot integrity against the CURRENT target (block stale instructions)
  const revalidated = await revalidateTarget({
    actionType,
    targetId: req.targetId,
    amountMinor: req.amountMinor,
    currency: req.currency,
    snapshot: (req.snapshot ?? {}) as Record<string, unknown>,
  });
  if (!revalidated.ok) {
    return { ok: false, status: 409, error: `Target changed since request: ${revalidated.issues.join("; ")}` };
  }

  // 5. CAS claim pending → executing (exactly one approver executes)
  const claim = await prisma.financialApproval.updateMany({
    where: { id: req.id, status: "pending" },
    data: { status: "executing", reviewerEmail: approver.email.toLowerCase(), reviewerUserId: approver.email, approvedAt: new Date() },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Approval already decided by another reviewer" };

  // 6. execute the CANONICAL financial service (idempotent at that layer)
  try {
    await TARGET_LIST[actionType].execute(req.targetId, approver.email);
    await prisma.financialApproval.update({ where: { id: req.id }, data: { status: "executed", executedAt: new Date() } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Execution failed";
    await prisma.financialApproval.update({ where: { id: req.id }, data: { status: "failed", failedAt: new Date(), executionError: msg } });
    await notifyRequester(req.requesterEmail, "financial.execution_failed", "Financial action failed", `The approved financial action failed to execute: ${msg}`, "/saas/financial-approvals");
    await writeSaasAudit({ byEmail: approver.email, action: "financial.approval_execution_failed", entity: "financial_approval", entityId: req.id, detail: msg, ip: ip ?? undefined, after: { status: "failed" } });
    return { ok: false, status: 400, error: msg };
  }

  await writeSaasAudit({
    byEmail: approver.email,
    action: "financial.approval_executed",
    entity: "financial_approval",
    entityId: req.id,
    detail: `${actionType} ${(req.amountMinor / 100).toFixed(2)} ${req.currency} target ${req.targetId}`,
    ip: ip ?? undefined,
    before: { requester: req.requesterEmail },
    after: { status: "executed", approvedAt: new Date().toISOString() },
  });
  await notifyRequester(req.requesterEmail, "financial.approved", "Financial action approved", `Your ${ACTION_LABELS[actionType].toLowerCase()} request was approved and executed.`, "/saas/financial-approvals");
  return { ok: true, status: 200, executed: true };
}

/* ------------------------------------------------------------------------- */
/* Reject / Cancel / Expire                                                    */
/* ------------------------------------------------------------------------- */

export async function rejectFinancialApproval(
  requestId: string,
  reviewer: Pick<AuthUser, "email" | "role">,
  reason: string,
  ip?: string | null,
): Promise<DecisionResult> {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { ok: false, status: 400, error: "Rejection reason is required" };
  if (!hasSaasPerm(reviewer, "FINANCIAL_APPROVE")) return { ok: false, status: 403, error: "FINANCIAL_APPROVE required" };
  const req = await prisma.financialApproval.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "Approval not found" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Approval already ${req.status}` };
  const claim = await prisma.financialApproval.updateMany({
    where: { id: req.id, status: "pending" },
    data: { status: "rejected", reviewerEmail: reviewer.email.toLowerCase(), rejectedAt: new Date(), decisionReason: trimmed },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Approval already decided by another reviewer" };
  await writeSaasAudit({ byEmail: reviewer.email, action: "financial.approval_rejected", entity: "financial_approval", entityId: req.id, detail: trimmed, ip: ip ?? undefined, after: { status: "rejected" } });
  await notifyRequester(req.requesterEmail, "financial.rejected", "Financial action not approved", `Your financial action request was rejected: ${trimmed}`, "/saas/financial-approvals");
  return { ok: true, status: 200 };
}

/** Requester (or an approver with FINANCIAL_APPROVE) may cancel a pending request. */
export async function cancelFinancialApproval(
  requestId: string,
  user: { email: string; role?: string },
  ip?: string | null,
): Promise<DecisionResult> {
  const req = await prisma.financialApproval.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "Approval not found" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Approval already ${req.status}` };
  const isRequester = req.requesterEmail === user.email.trim().toLowerCase();
  const isApprover = hasSaasPerm(user as Pick<AuthUser, "email" | "role">, "FINANCIAL_APPROVE");
  if (!isRequester && !isApprover) {
    return { ok: false, status: 403, error: "Only the requester or an approver can cancel this request" };
  }
  const claim = await prisma.financialApproval.updateMany({
    where: { id: req.id, status: "pending" },
    data: { status: "cancelled", cancelledAt: new Date(), reviewerEmail: isApprover && !isRequester ? user.email.toLowerCase() : null },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Approval already decided by another reviewer" };
  await writeSaasAudit({ byEmail: user.email, action: "financial.approval_cancelled", entity: "financial_approval", entityId: req.id, ip: ip ?? undefined });
  return { ok: true, status: 200 };
}

async function markExpired(id: string, ip?: string | null): Promise<void> {
  const claim = await prisma.financialApproval.updateMany({ where: { id, status: "pending" }, data: { status: "expired", expiredAt: new Date() } });
  if (claim.count === 0) return;
  const req = await prisma.financialApproval.findUnique({ where: { id }, select: { requesterEmail: true, actionType: true, amountMinor: true, currency: true } });
  if (!req) return;
  await writeSaasAudit({ byEmail: "system", action: "financial.approval_expired", entity: "financial_approval", entityId: id, ip: ip ?? undefined });
  await notifyRequester(req.requesterEmail, "financial.expired", "Financial approval expired", `Your ${req.actionType} request (${(req.amountMinor / 100).toFixed(2)} ${req.currency}) has expired.`, "/saas/financial-approvals");
}

/** Sweep pending approvals past their expiry. Returns count expired. */
export async function expireFinancialApprovals(now: Date = new Date()): Promise<number> {
  const expired = await prisma.financialApproval.findMany({
    where: { status: "pending", expiresAt: { lt: now } },
    select: { id: true },
  });
  let count = 0;
  for (const r of expired) {
    try {
      await markExpired(r.id);
      count++;
    } catch {
      // continue sweeping
    }
  }
  return count;
}

/* ------------------------------------------------------------------------- */
/* Reads                                                                       */
/* ------------------------------------------------------------------------- */

export async function listFinancialApprovals(opts?: {
  status?: string;
  actionType?: string;
  requesterEmail?: string;
  currency?: string;
  take?: number;
  skip?: number;
}) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.actionType) where.actionType = opts.actionType;
  if (opts?.requesterEmail) where.requesterEmail = opts.requesterEmail.trim().toLowerCase();
  if (opts?.currency) where.currency = opts.currency;
  const [items, total] = await Promise.all([
    prisma.financialApproval.findMany({ where, orderBy: { createdAt: "desc" }, take: opts?.take ?? 50, skip: opts?.skip ?? 0 }),
    prisma.financialApproval.count({ where }),
  ]);
  return { items, total };
}

export interface ApprovalDetail {
  approval: Record<string, unknown>;
  current: TargetState | null;
  differences: string[];
  canApprove: boolean;
}

export async function getFinancialApprovalDetail(id: string): Promise<ApprovalDetail | null> {
  const approval = await prisma.financialApproval.findUnique({ where: { id } });
  if (!approval) return null;
  const actionType = approval.actionType as FinancialActionType;
  const revalidated = isFinancialActionType(actionType)
    ? await revalidateTarget({ actionType, targetId: approval.targetId, amountMinor: approval.amountMinor, currency: approval.currency, snapshot: (approval.snapshot ?? {}) as Record<string, unknown> })
    : { ok: false, issues: ["Unsupported action type"], current: null };
  const pending = approval.status === "pending";
  const valid = Boolean(revalidated.ok && approval.expiresAt && approval.expiresAt.getTime() > Date.now());
  return {
    approval: { ...approval, snapshot: approval.snapshot } as never,
    current: revalidated.current,
    differences: revalidated.issues,
    canApprove: pending && valid,
  };
}

/* ------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* ------------------------------------------------------------------------- */

async function notifyRequester(requesterEmail: string, kind: string, title: string, body: string, href: string): Promise<void> {
  await pushNotification({ userId: requesterEmail, kind, title, body, href }).catch(() => {});
}
