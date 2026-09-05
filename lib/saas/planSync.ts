/**
 * Pricing approval workflow service.
 *
 * Marketing Admin users propose commercial changes to the canonical SaaS Plan
 * catalog; with `require_marketing_pricing_approval` ON nothing applies until a
 * Super Admin approves. Supports structural actions:
 *   update | create | archive | activate | deactivate
 *
 * Guarantees:
 * - Whitelist-only patches (financial tables are structurally unreachable)
 * - Self-approval blocked by email identity
 * - Staleness via Plan.version (409 + auto-reject on drift)
 * - Approval re-syncs the US baseline (storefront units ↔ billing cents)
 * - Every decision writes an audit record
 */
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";
import { hasSaasPerm } from "@/lib/saas/roles";
import { validatePlanInput, updatePlan, createPlan, archivePlan, type PlanInput } from "@/lib/saas/plans";
import { writeSaasAudit } from "@/lib/saas/audit";
import { validateCountryPriceEntries, applyCountryPrices, type ValidatedEntry } from "@/lib/saas/pricingSync";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

export const REQUEST_ACTIONS = ["update", "create", "archive", "activate", "deactivate"] as const;
export type RequestAction = (typeof REQUEST_ACTIONS)[number];

/** Every field a proposal may ever touch. Nothing else gets through. */
export const PROPOSABLE_FIELDS = [
  "name",
  "slug",
  "monthlyPrice",
  "annualPrice",
  "currency",
  "trialDays",
  "maxProperties",
  "maxUsers",
  "maxBookings",
  "storageGb",
  "features",
  "isActive",
  "description",
  "tagline",
  "descriptor",
  "roomMin",
  "roomMax",
  "adminLimit",
  "staffLimit",
  "featured",
  "displayOrder",
  "isCustomPrice",
] as const;

export interface PlanSnapshot {
  [key: string]: unknown;
}

export function planSnapshot(plan: Record<string, unknown>): PlanSnapshot {
  const out: Record<string, unknown> = {};
  for (const f of PROPOSABLE_FIELDS) if (plan[f] !== undefined) out[f] = plan[f];
  return out;
}

/** Keep only proposalable fields from an arbitrary payload. */
export function pickProposable(patch: Record<string, unknown>): Partial<PlanInput> {
  const out: Record<string, unknown> = {};
  for (const f of PROPOSABLE_FIELDS) if (patch[f] !== undefined) out[f] = patch[f];
  return out as Partial<PlanInput>;
}

export function mergeProposal(before: PlanSnapshot, patch: Partial<PlanInput>): PlanSnapshot {
  return { ...before, ...(patch as Record<string, unknown>) };
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

/**
 * Separate per-country price changes ({countryPrices:[…]}) from plan-field
 * changes in an incoming patch. Country entries are validated against the
 * existing country catalog — unknown markets or mismatched currencies are
 * rejected before anything is persisted.
 */
export function splitCountryPrices(patch: Record<string, unknown>): {
  planPatch: Record<string, unknown>;
  countryPrices?: ValidatedEntry[];
  error?: string;
} {
  if (patch.countryPrices === undefined) return { planPatch: patch };
  const v = validateCountryPriceEntries(patch.countryPrices);
  if (!v.ok) return { planPatch: {}, error: v.error };
  const { countryPrices, ...rest } = patch;
  void countryPrices;
  return { planPatch: rest, countryPrices: v.value };
}

export function isSuperTier(user: Pick<AuthUser, "email" | "role">): boolean {
  return hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE");
}

export function selfApprovalError(requestedByEmail: string, reviewerEmail: string): string | null {
  return requestedByEmail.trim().toLowerCase() === reviewerEmail.trim().toLowerCase()
    ? "Self-approval is not allowed: the reviewer must differ from the requester."
    : null;
}

/**
 * Does the canonical billing price match the storefront baseline?
 * Billing is USD cents; the US storefront row is local units (= USD here).
 */
export function baselineMatches(
  usUnits: { monthly: number; annual: number } | undefined,
  plan: { monthlyPrice: number; annualPrice: number },
): boolean {
  if (!usUnits) return false;
  return usUnits.monthly * 100 === plan.monthlyPrice && usUnits.annual * 100 === plan.annualPrice;
}

// ---------------------------------------------------------------------------
// Workflow operations
// ---------------------------------------------------------------------------

export type SubmitResult =
  | { outcome: "applied"; planId?: string }
  | { outcome: "pending"; requestId: string }
  | { outcome: "error"; error: string };

function normalizeAction(raw: unknown): RequestAction {
  const a = String(raw ?? "update").trim().toLowerCase();
  return (REQUEST_ACTIONS as readonly string[]).includes(a) ? (a as RequestAction) : "update";
}

/** Exported for direct PATCH routes so billing-cents edits keep the US invariant. */
export async function syncUsBaseline(
  plan: {
    id: string;
    slug: string | null;
    marketingPlanId: string | null;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    isCustomPrice?: boolean;
  },
  byEmail: string,
): Promise<void> {
  const marketingId = plan.marketingPlanId ?? plan.slug;
  if (!marketingId) return;
  const { getPricingDoc, savePricingDoc } = await import("@/lib/pricing/db");
  const doc = await getPricingDoc();
  const profiles = structuredClone(doc.profiles);
  const us = profiles.US as { prices: Record<string, { monthly: number; annual: number }> } | undefined;
  const units = { monthly: Math.round(plan.monthlyPrice / 100), annual: Math.round(plan.annualPrice / 100) };
  let changed = false;
  if (us?.prices?.[marketingId]) {
    if (!baselineMatches(us.prices[marketingId], plan)) {
      // Custom/contact-sales plans keep the 0/0 "Contact us" marker.
      us.prices[marketingId] = plan.isCustomPrice ? { monthly: 0, annual: 0 } : units;
      changed = true;
    }
  } else if (us) {
    us.prices[marketingId] = plan.isCustomPrice ? { monthly: 0, annual: 0 } : units;
    changed = true;
  }
  if (changed) {
    await savePricingDoc({
      profiles,
      label: `US baseline synced from plan "${plan.name}" (${marketingId})`,
      byEmail,
    });
  }
  // Canonical country-price row for the US market.
  await prisma.planCountryPrice.upsert({
    where: { planId_country: { planId: plan.id, country: "US" } },
    create: {
      planId: plan.id,
      country: "US",
      currency: "USD",
      monthly: Math.round(plan.monthlyPrice / 100),
      annual: Math.round(plan.annualPrice / 100),
    },
    update: {
      currency: "USD",
      monthly: Math.round(plan.monthlyPrice / 100),
      annual: Math.round(plan.annualPrice / 100),
    },
  });
}

/**
 * Marketing-side entry point. With approval OFF the change applies immediately
 * (audited); with approval ON a pending PlanChangeRequest is created.
 * `action` supports structural proposals: create plans, archive, toggle.
 */
export async function submitMarketingPlanChange(opts: {
  user: Pick<AuthUser, "email" | "role">;
  action?: string;
  planId?: string;
  patch: Record<string, unknown>;
  reason?: string;
  ip?: string | null;
}): Promise<SubmitResult> {
  const action = normalizeAction(opts.action);
  const split = splitCountryPrices(opts.patch);
  if (split.error) return { outcome: "error", error: split.error };
  const clean = pickProposable(split.planPatch);
  const ip = opts.ip ?? null;

  if (action === "create") {
    const v = validatePlanInput(clean as Partial<PlanInput>, true);
    if (!v.ok) return { outcome: "error", error: v.error };
    const dup = await prisma.plan.findUnique({ where: { slug: String(clean.slug).toLowerCase() } });
    if (dup) return { outcome: "error", error: "slug already exists" };
    const { defaultApprovalRequirement } = await import("@/lib/saas/settings");
    if (!(await defaultApprovalRequirement())) {
      const plan = await createPlan(clean as PlanInput);
      if (split.countryPrices?.length) {
        // Surface applier failures — a half-applied create must not look applied.
        await applyCountryPrices(plan.id, split.countryPrices, opts.user.email);
      }
      await writeSaasAudit({
        byEmail: opts.user.email,
        action: "plan.created_direct",
        entity: "plan",
        entityId: plan.id,
        detail: `created ${plan.slug}`,
        before: null,
        after: plan,
        ip: ip ?? undefined,
      });
      await syncUsBaseline(plan as never, opts.user.email);
      return { outcome: "applied", planId: plan.id };
    }
    const proposedCreate: Record<string, unknown> = { ...(clean as Record<string, unknown>) };
    if (split.countryPrices?.length) proposedCreate.countryPrices = split.countryPrices;
    const req = await prisma.planChangeRequest.create({
      data: {
        action: "create",
        requestedByEmail: opts.user.email.trim().toLowerCase(),
        status: "pending",
        beforeSnapshot: {} as never,
        proposedSnapshot: proposedCreate as never,
        reason: opts.reason ?? null,
        baseVersion: 0,
      },
    });
    await writeSaasAudit({
      byEmail: opts.user.email,
      action: "plan.change_submitted",
      entity: "plan_request",
      entityId: req.id,
      detail: `create proposal for "${clean.slug}"`,
      after: clean,
      ip: ip ?? undefined,
    });
    return { outcome: "pending", requestId: req.id };
  }

  // All other actions require an existing plan.
  if (!opts.planId) return { outcome: "error", error: "planId required" };
  const plan = await prisma.plan.findUnique({
    where: { id: opts.planId },
    include: { countryPrices: { where: { country: "US" } } },
  });
  if (!plan) return { outcome: "error", error: "plan not found" };

  const before = planSnapshot(plan as unknown as Record<string, unknown>);
  let patch: Partial<PlanInput> = {};

  if (action === "archive") {
    patch = { isActive: false };
  } else if (action === "activate") {
    patch = { isActive: true };
  } else if (action === "deactivate") {
    patch = { isActive: false };
  } else {
    patch = clean;
    if (Object.keys(patch).length === 0 && !split.countryPrices) return { outcome: "error", error: "nothing to change" };
    if (Object.keys(patch).length > 0) {
      const v = validatePlanInput(patch, false);
      if (!v.ok) return { outcome: "error", error: v.error };
    }
  }

  // Country-price proposals: capture authoritative before-values for audit
  // (previous value / requested value per market+currency).
  let countryBefore: ValidatedEntry[] | undefined;
  const countryPrices = split.countryPrices;
  if (countryPrices) {
    const rows = await prisma.planCountryPrice.findMany({
      where: { planId: plan.id, country: { in: countryPrices.map((e) => e.country) } },
    });
    const rowByCountry = new Map(rows.map((r) => [r.country, r]));
    countryBefore = countryPrices.map((e) => {
      const r = rowByCountry.get(e.country);
      return r
        ? { country: r.country, currency: r.currency, monthly: r.monthly, annual: r.annual }
        : { ...e, monthly: 0, annual: 0 };
    });
    const changed = countryPrices.some((e) => {
      const b = countryBefore!.find((x) => x.country === e.country)!;
      return b.monthly !== e.monthly || b.annual !== e.annual;
    });
    if (!changed && Object.keys(patch).length === 0) return { outcome: "error", error: "nothing to change" };
  }

  const { getApprovalRequirement } = await import("@/lib/saas/settings");
  const needsApproval = await getApprovalRequirement();

  if (!needsApproval) {
    let updated;
    if (action === "archive") {
      updated = await archivePlan(plan.id);
    } else {
      updated = Object.keys(patch).length > 0 ? await updatePlan(plan.id, patch) : plan;
    }
    if (countryPrices?.length && action !== "archive") {
      await applyCountryPrices(plan.id, countryPrices, opts.user.email);
    }
    await writeSaasAudit({
      byEmail: opts.user.email,
      action: "plan.changed_direct",
      entity: "plan",
      entityId: plan.id,
      detail: `${action} applied directly (approval disabled)${countryPrices ? ` (${countryPrices.map((e) => e.country).join(",")})` : ""}`,
      before,
      after: updated,
      ip: ip ?? undefined,
    });
    await syncUsBaseline(updated as never, opts.user.email);
    return { outcome: "applied", planId: plan.id };
  }

  const proposed = mergeProposal(before, patch);
  if (countryPrices) (proposed as Record<string, unknown>).countryPrices = countryPrices;
  if (countryBefore) (before as Record<string, unknown>).countryPrices = countryBefore;
  const req = await prisma.planChangeRequest.create({
    data: {
      planId: plan.id,
      action,
      requestedByEmail: opts.user.email.trim().toLowerCase(),
      status: "pending",
      beforeSnapshot: before as never,
      proposedSnapshot: proposed as never,
      reason: opts.reason ?? null,
      baseVersion: plan.version,
    },
  });
  await writeSaasAudit({
    byEmail: opts.user.email,
    action: "plan.change_submitted",
    entity: "plan_request",
    entityId: req.id,
    detail: `${action} proposal for ${plan.slug}${countryPrices ? ` (${countryPrices.map((e) => e.country).join(",")})` : ""}`,
    after: proposed,
    ip: ip ?? undefined,
  });
  return { outcome: "pending", requestId: req.id };
}

export interface ApproveResult {
  ok: boolean;
  status: number;
  error?: string;
  planId?: string;
}

export async function approvePlanChange(requestId: string, reviewer: Pick<AuthUser, "email" | "role">, ip?: string | null): Promise<ApproveResult> {
  // Permission first — unauthorized callers must not be able to probe
  // request existence or state via 404/409 differences.
  if (!isSuperTier(reviewer)) return { ok: false, status: 403, error: "Super Admin access required" };
  const req = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "request not found" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Request already ${req.status}` };
  const selfErr = selfApprovalError(req.requestedByEmail, reviewer.email);
  if (selfErr) return { ok: false, status: 403, error: selfErr };

  // Create requests have no plan/version to go stale.
  if (req.action !== "create") {
    if (!req.planId) return { ok: false, status: 404, error: "plan not found" };
    const plan = await prisma.plan.findUnique({ where: { id: req.planId } });
    if (!plan) return { ok: false, status: 404, error: "plan not found" };
    if (isStaleRequest(req.baseVersion, plan.version)) {
      await prisma.planChangeRequest.update({
        where: { id: req.id },
        data: {
          status: "rejected",
          reviewedByEmail: reviewer.email,
          reviewedAt: new Date(),
          rejectionReason: "Plan changed after this request was submitted.",
        },
      });
      return { ok: false, status: 409, error: "Plan changed after this request was submitted." };
    }
  }

  let planId = req.planId ?? undefined;

  if (req.action === "create") {
    const input = pickProposable(req.proposedSnapshot as Record<string, unknown>) as PlanInput;
    try {
      const created = await createPlan(input);
      planId = created.id;
    } catch (e) {
      return { ok: false, status: 409, error: e instanceof Error ? e.message : "create failed" };
    }
  } else if (req.action === "archive") {
    await archivePlan(req.planId!);
  } else {
    const plan = await prisma.plan.findUnique({ where: { id: req.planId! } });
    const before = planSnapshot(plan as unknown as Record<string, unknown>);
    const patch =
      req.action === "activate"
        ? { isActive: true }
        : req.action === "deactivate"
          ? { isActive: false }
          : patchFromDiff(before, req.proposedSnapshot as PlanSnapshot);
    if (Object.keys(patch).length > 0) {
      await updatePlan(plan!.id, patch as Partial<PlanInput>);
    }
  }

  // Approved country prices → canonical rows + US invariant + PricingDoc
  // mirror, via the same applier the SaaS side uses (single write path).
  // Applier failures propagate: the request stays pending so the reviewer can
  // retry instead of a silently half-applied "approved" state.
  const proposedCountryPrices = (req.proposedSnapshot as Record<string, unknown> | null)?.countryPrices;
  if (planId && Array.isArray(proposedCountryPrices) && proposedCountryPrices.length > 0 && req.action !== "archive") {
    const v = validateCountryPriceEntries(proposedCountryPrices);
    if (!v.ok) return { ok: false, status: 422, error: `stored proposal invalid: ${v.error}` };
    await applyCountryPrices(planId, v.value, reviewer.email);
  }

  // Always restore the US baseline — even country-price-only proposals may
  // carry billing-cents changes that must mirror into storefront units.
  const updatedPlan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null;
  if (updatedPlan) await syncUsBaseline(updatedPlan as never, reviewer.email);

  // Atomic claim: only one reviewer's decision lands; losers get 409.
  const claim = await prisma.planChangeRequest.updateMany({
    where: { id: req.id, status: "pending" },
    data: {
      status: "approved",
      reviewedByEmail: reviewer.email,
      reviewedAt: new Date(),
      ...(planId ? { planId } : {}),
    },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Request already decided by another reviewer" };
  await writeSaasAudit({
    byEmail: reviewer.email,
    action: "plan.change_approved",
    entity: "plan_request",
    entityId: req.id,
    detail: `${req.action} approved`,
    before: req.beforeSnapshot,
    after: req.proposedSnapshot,
    ip: ip ?? undefined,
  });
  return { ok: true, status: 200, planId };
}

export async function rejectPlanChange(requestId: string, reviewer: Pick<AuthUser, "email" | "role">, reason: string, ip?: string | null): Promise<ApproveResult> {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) return { ok: false, status: 400, error: "Rejection reason is required" };
  if (!isSuperTier(reviewer)) return { ok: false, status: 403, error: "Super Admin access required" };
  const req = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "request not found" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Request already ${req.status}` };
  const claim = await prisma.planChangeRequest.updateMany({
    where: { id: req.id, status: "pending" },
    data: {
      status: "rejected",
      reviewedByEmail: reviewer.email,
      reviewedAt: new Date(),
      rejectionReason: trimmed,
    },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Request already decided by another reviewer" };
  await writeSaasAudit({
    byEmail: reviewer.email,
    action: "plan.change_rejected",
    entity: "plan_request",
    entityId: req.id,
    detail: `${req.action} rejected: ${trimmed}`,
    before: req.beforeSnapshot,
    after: req.proposedSnapshot,
    ip: ip ?? undefined,
  });
  return { ok: true, status: 200 };
}

export async function cancelPlanChange(requestId: string, user: Pick<AuthUser, "email" | "role">): Promise<ApproveResult> {
  const req = await prisma.planChangeRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, status: 404, error: "request not found" };
  if (req.status !== "pending") return { ok: false, status: 409, error: `Request already ${req.status}` };
  if (req.requestedByEmail !== user.email.trim().toLowerCase()) {
    return { ok: false, status: 403, error: "Only the requester can cancel this request" };
  }
  const claim = await prisma.planChangeRequest.updateMany({
    where: { id: req.id, status: "pending" },
    data: { status: "cancelled" },
  });
  if (claim.count === 0) return { ok: false, status: 409, error: "Request already decided by another reviewer" };
  await writeSaasAudit({
    byEmail: user.email,
    action: "plan.change_cancelled",
    entity: "plan_request",
    entityId: req.id,
    detail: `${req.action} proposal withdrawn`,
  });
  return { ok: true, status: 200 };
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
