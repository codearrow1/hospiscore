/**
 * Plan synchronization + pricing approval workflow.
 *
 * Canonical source: the Prisma `Plan` table. Marketing's localized pricing
 * document (`lib/pricing/db.ts`) remains the per-country storefront layer;
 * its US baseline is kept in sync with the linked canonical plan.
 *
 * Marketing Admin (capability `pricing.manage`) proposes changes; when the
 * approval setting is ON, proposals become PlanChangeRequest rows and only a
 * Super Admin can apply them. Every decision is audited via writeSaasAudit.
 */
import { prisma } from "@/lib/prisma";
import { hasSaasPerm } from "@/lib/saas/roles";
import { validatePlanInput, updatePlan, type PlanInput } from "@/lib/saas/plans";
import { getApprovalRequirement } from "@/lib/saas/settings";
import { writeSaasAudit } from "@/lib/saas/audit";
import type { AuthUser } from "@/lib/auth";

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Fields Marketing Admin may propose changing on a canonical plan. */
export const PROPOSABLE_FIELDS = [
  "name",
  "monthlyPrice",
  "annualPrice",
  "trialDays",
  "maxProperties",
  "maxUsers",
  "maxBookings",
  "storageGb",
  "features",
  "isActive",
] as const;

export interface PlanSnapshot {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  maxProperties: number | null;
  maxUsers: number | null;
  maxBookings: number | null;
  storageGb: number | null;
  features: Record<string, unknown> | null;
  isActive: boolean;
}

export function planSnapshot(plan: {
  name: string; monthlyPrice: number; annualPrice: number; currency: string;
  trialDays: number; maxProperties: number | null; maxUsers: number | null;
  maxBookings: number | null; storageGb: number | null;
  features: unknown; isActive: boolean;
}): PlanSnapshot {
  return {
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    currency: plan.currency,
    trialDays: plan.trialDays,
    maxProperties: plan.maxProperties,
    maxUsers: plan.maxUsers,
    maxBookings: plan.maxBookings,
    storageGb: plan.storageGb,
    features: (plan.features as Record<string, unknown> | null) ?? null,
    isActive: plan.isActive,
  };
}

/** Keep only proposalable fields from an arbitrary payload. */
export function pickProposable(patch: Record<string, unknown>): Partial<PlanInput> {
  const out: Record<string, unknown> = {};
  for (const f of PROPOSABLE_FIELDS) if (patch[f] !== undefined) out[f] = patch[f];
  return out as Partial<PlanInput>;
}

export function mergeProposal(before: PlanSnapshot, patch: Partial<PlanInput>): PlanSnapshot {
  return { ...before, ...(patch as Partial<PlanSnapshot>) };
}

export function diffSnapshots(
  before: PlanSnapshot,
  after: PlanSnapshot,
): { field: string; before: unknown; after: unknown }[] {
  const diffs: { field: string; before: unknown; after: unknown }[] = [];
  for (const f of PROPOSABLE_FIELDS) {
    const b = before[f];
    const a = after[f];
    const changed =
      f === "features"
        ? JSON.stringify(b ?? null) !== JSON.stringify(a ?? null)
        : b !== a;
    if (changed) diffs.push({ field: f, before: b, after: a });
  }
  return diffs;
}

/** Patch that turns `before` into `after` restricted to proposable fields. */
export function patchFromDiff(before: PlanSnapshot, after: PlanSnapshot): Partial<PlanInput> {
  return Object.fromEntries(diffSnapshots(before, after).map((d) => [d.field, d.after])) as Partial<PlanInput>;
}

export function isStaleRequest(baseVersion: number, currentVersion: number): boolean {
  return baseVersion !== currentVersion;
}

export function isSuperTier(user: Pick<AuthUser, "email" | "role">): boolean {
  return hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE");
}

export function selfApprovalError(requestedByEmail: string, reviewerEmail: string): string | null {
  return requestedByEmail.trim().toLowerCase() === reviewerEmail.trim().toLowerCase()
    ? "Self-approval is not allowed: the reviewer must differ from the requester."
    : null;
}

export async function ensureDefaultPlanLinks(): Promise<{ linked: number }> {
  const plans = await prisma.plan.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(plans.map((p) => [p.slug, p.id]));
  const catalogIds = ["solopreneur", "starter", "growth", "professional", "enterprise"];
  let linked = 0;
  for (const marketingPlanId of catalogIds) {
    const planId = bySlug.get(marketingPlanId);
    if (!planId) continue;
    const existing = await prisma.planLink.findUnique({ where: { marketingPlanId } });
    if (existing) continue;
    await prisma.planLink.create({ data: { marketingPlanId, planId } });
    linked++;
  }
  return { linked };
}

// ---------------------------------------------------------------------------
// Workflow operations
// ---------------------------------------------------------------------------

export type SubmitResult =
  | { outcome: "applied"; plan: Awaited<ReturnType<typeof updatePlan>> }
  | { outcome: "pending"; requestId: string }
  | { outcome: "error"; error: string };

/**
 * Marketing-side entry point. With approval OFF the change applies
 * immediately (still audited); with ON it becomes a pending request.
 */
export async function submitMarketingPlanChange(
  user: Pick<AuthUser, "email" | "role" | "name">,
  planId: string,
  rawPatch: Record<string, unknown>,
  reason?: string,
): Promise<SubmitResult> {
  if (!user?.email) return { outcome: "error", error: "Authentication required" };
  const patch = pickProposable(rawPatch);
  const v = validatePlanInput(patch, false);
  if (!v.ok) return { outcome: "error", error: v.error };
  if (Object.keys(patch).length === 0) return { outcome: "error", error: "No changeable fields provided" };

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return { outcome: "error", error: "Plan not found" };

  const before = planSnapshot(plan);
  const proposed = mergeProposal(before, patch);
  const requiresApproval = await getApprovalRequirement();

  if (!requiresApproval && isSuperTier(user)) {
    // Super Admin editing directly through this endpoint: immediate.
    const updated = await updatePlan(planId, patch);
    await writeSaasAudit({
      byEmail: user.email,
      action: "plan.updated_direct",
      entity: "plan",
      entityId: planId,
      detail: Object.keys(patch).join(","),
      before: before as never,
      after: planSnapshot(updated) as never,
    });
    return { outcome: "applied", plan: updated };
  }

  if (!requiresApproval) {
    // Approval disabled: trusted marketing change applies immediately.
    const updated = await updatePlan(planId, patch);
    await writeSaasAudit({
      byEmail: user.email,
      action: "plan.updated_by_marketing",
      entity: "plan",
      entityId: planId,
      detail: Object.keys(patch).join(","),
      before: before as never,
      after: planSnapshot(updated) as never,
    });
    await syncBaselineAfterPlanChange(planId, user.email).catch(() => {});
    return { outcome: "applied", plan: updated };
  }

  const request = await prisma.planChangeRequest.create({
    data: {
      planId,
      requestedByEmail: user.email.toLowerCase(),
      status: "pending",
      beforeSnapshot: before as never,
      proposedSnapshot: proposed as never,
      reason: reason?.trim() || null,
      baseVersion: plan.version,
    },
  });
  await writeSaasAudit({
    byEmail: user.email,
    action: "plan.change_requested",
    entity: "plan",
    entityId: planId,
    detail: `${Object.keys(patch).join(",")} (request ${request.id})`,
  });
  return { outcome: "pending", requestId: request.id };
}

export async function approvePlanChange(
  reviewer: Pick<AuthUser, "email" | "role">,
  requestId: string,
): Promise<{ ok: true; planId: string } | { ok: false; status: number; error: string }> {
  if (!isSuperTier(reviewer)) return { ok: false, status: 403, error: "Super Admin access required" };
  const request = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, status: 404, error: "Request not found" };
  if (request.status !== "pending") {
    return { ok: false, status: 409, error: `Request already ${request.status}` };
  }
  const selfErr = selfApprovalError(request.requestedByEmail, reviewer.email);
  if (selfErr) return { ok: false, status: 403, error: selfErr };

  const plan = await prisma.plan.findUnique({ where: { id: request.planId } });
  if (!plan) return { ok: false, status: 404, error: "Plan not found" };
  if (isStaleRequest(request.baseVersion, plan.version)) {
    await prisma.planChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        rejectionReason: "Plan changed after this request was submitted.",
        reviewedByEmail: reviewer.email,
        reviewedAt: new Date(),
      },
    });
    return { ok: false, status: 409, error: "Plan changed after this request was submitted." };
  }

  const before = planSnapshot(plan);
  const proposed = request.proposedSnapshot as unknown as PlanSnapshot;
  const patch = patchFromDiff(before, proposed);
  const updated = await updatePlan(plan.id, patch);
  await syncBaselineAfterPlanChange(plan.id, reviewer.email).catch(() => {});
  await prisma.planChangeRequest.update({
    where: { id: requestId },
    data: { status: "approved", reviewedByEmail: reviewer.email, reviewedAt: new Date() },
  });
  await writeSaasAudit({
    byEmail: reviewer.email,
    action: "plan.change_approved",
    entity: "plan",
    entityId: plan.id,
    detail: `request ${requestId} by ${request.requestedByEmail}`,
    before: before as never,
    after: planSnapshot(updated) as never,
  });
  return { ok: true, planId: plan.id };
}

export async function rejectPlanChange(
  reviewer: Pick<AuthUser, "email" | "role">,
  requestId: string,
  rejectionReason: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSuperTier(reviewer)) return { ok: false, status: 403, error: "Super Admin access required" };
  const reason = rejectionReason?.trim();
  if (!reason) return { ok: false, status: 400, error: "A rejection reason is required" };
  const request = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, status: 404, error: "Request not found" };
  if (request.status !== "pending") {
    return { ok: false, status: 409, error: `Request already ${request.status}` };
  }
  const selfErr = selfApprovalError(request.requestedByEmail, reviewer.email);
  if (selfErr) return { ok: false, status: 403, error: selfErr };
  await prisma.planChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      rejectionReason: reason,
      reviewedByEmail: reviewer.email,
      reviewedAt: new Date(),
    },
  });
  await writeSaasAudit({
    byEmail: reviewer.email,
    action: "plan.change_rejected",
    entity: "plan",
    entityId: request.planId,
    detail: `request ${requestId}: ${reason}`,
  });
  return { ok: true };
}

export async function cancelPlanChange(
  requesterEmail: string,
  requestId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const request = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, status: 404, error: "Request not found" };
  if (request.requestedByEmail.toLowerCase() !== requesterEmail.toLowerCase()) {
    return { ok: false, status: 403, error: "Only the requester can cancel" };
  }
  if (request.status !== "pending") {
    return { ok: false, status: 409, error: `Request already ${request.status}` };
  }
  await prisma.planChangeRequest.update({
    where: { id: requestId },
    data: { status: "cancelled", reviewedAt: new Date() },
  });
  return { ok: true };
}

export async function listRequests(status?: string, planId?: string) {
  return prisma.planChangeRequest.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(planId ? { planId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { plan: { select: { name: true, slug: true, version: true, monthlyPrice: true, annualPrice: true } } },
  });
}

/** Requests submitted by one user (marketing pricing page panel). */
export async function getRequestsForEmail(email: string) {
  return prisma.planChangeRequest.findMany({
    where: { requestedByEmail: email.trim().toLowerCase() },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { plan: { select: { name: true, slug: true } } },
  });
}

// ---------------------------------------------------------------------------
// Baseline synchronization (canonical Plan → marketing PricingDoc US profile)
// ---------------------------------------------------------------------------

function baselineProfileCode(): string {
  return "US";
}

/** Pure: does the storefront price point equal the canonical plan price? */
export function baselineMatches(
  price: { monthly: number; annual: number } | undefined,
  plan: { monthlyPrice: number; annualPrice: number },
): boolean {
  if (!price) return false;
  return price.monthly === plan.monthlyPrice && price.annual === plan.annualPrice;
}

/** Pure: return profiles with the baseline price point set from the plan. */
export function withBaseline<P extends { prices: Record<string, { monthly: number; annual: number }> }>(
  profiles: Record<string, P>,
  code: string,
  marketingPlanId: string,
  plan: { monthlyPrice: number; annualPrice: number },
): Record<string, P> {
  if (!profiles[code]?.prices?.[marketingPlanId]) return profiles;
  const next = structuredClone(profiles);
  next[code].prices[marketingPlanId] = {
    ...next[code].prices[marketingPlanId],
    monthly: plan.monthlyPrice,
    annual: plan.annualPrice,
  };
  return next;
}

/**
 * Keeps the marketing storefront baseline (US profile of the PricingDoc)
 * equal to the canonical plan prices for every linked plan. Localized
 * country profiles remain deliberate marketing edits — only the US baseline
 * is derived, so there is never a second independent USD active price.
 */
export async function syncBaselineAfterPlanChange(planId: string, byEmail: string): Promise<void> {
  const link = await prisma.planLink.findFirst({ where: { planId }, include: { plan: true } });
  if (!link) return;
  // The storefront marks "enterprise" as custom-priced (0/0 by validation rule);
  // canonical list prices must never overwrite that marker.
  if (link.marketingPlanId === "enterprise") return;
  const { getPricingDoc, savePricingDoc } = await import("@/lib/pricing/db");
  const doc = await getPricingDoc();
  const profile = doc.profiles[baselineProfileCode()];
  const price = (profile?.prices as Record<string, { monthly: number; annual: number }> | undefined)?.[
    link.marketingPlanId
  ];
  if (!price) return;
  const plan = link.plan;
  if (baselineMatches(price, plan)) return;
  const nextProfiles = withBaseline(doc.profiles, baselineProfileCode(), link.marketingPlanId, plan);
  await savePricingDoc({
    profiles: nextProfiles,
    label: `Baseline sync from plan "${plan.name}" (${plan.slug})`,
    byEmail,
  });
}

export interface SyncDriftRow {
  marketingPlanId: string;
  planId: string;
  planName: string;
  planMonthly: number;
  planAnnual: number;
  storeMonthly: number;
  storeAnnual: number;
  /** Storefront entry is a custom-quote marker (0/0) — intentionally not synced. */
  custom?: boolean;
}

/** Report drift between canonical plan prices and the storefront baseline. */
export async function pricingSyncStatus(): Promise<{
  drift: SyncDriftRow[];
  unlinkedMarketingIds: string[];
  unlinkedPlans: { id: string; name: string; slug: string }[];
}> {
  await ensureDefaultPlanLinks().catch(() => {});
  const links = await prisma.planLink.findMany({ include: { plan: true } });
  const { getPricingDoc } = await import("@/lib/pricing/db");
  const doc = await getPricingDoc();
  const baseline = (doc.profiles[baselineProfileCode()]?.prices ?? {}) as Record<
    string,
    { monthly: number; annual: number }
  >;
  const drift: SyncDriftRow[] = [];
  for (const l of links) {
    const p = baseline[l.marketingPlanId];
    if (!p) continue;
    if (!baselineMatches(p, l.plan)) {
      const custom = p.monthly === 0 && p.annual === 0;
      drift.push({
        marketingPlanId: l.marketingPlanId,
        planId: l.plan.id,
        planName: l.plan.name,
        planMonthly: l.plan.monthlyPrice,
        planAnnual: l.plan.annualPrice,
        storeMonthly: p.monthly,
        storeAnnual: p.annual,
        ...(custom ? { custom } : {}),
      });
    }
  }
  const linkedIds = new Set(links.map((l) => l.marketingPlanId));
  const unlinkedMarketingIds = ["solopreneur", "starter", "growth", "professional", "enterprise"].filter(
    (id) => !linkedIds.has(id),
  );
  const linkedPlanIds = new Set(links.map((l) => l.planId));
  const allPlans = await prisma.plan.findMany({ select: { id: true, name: true, slug: true } });
  const unlinkedPlans = allPlans.filter((pl) => !linkedPlanIds.has(pl.id));
  return { drift, unlinkedMarketingIds, unlinkedPlans };
}
