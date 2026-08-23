import { prisma } from "@/lib/prisma";
import { countryListing } from "@/lib/pricing/countries";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "grace" | "suspended" | "cancelled" | "expired" | "paused";

export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ["trial","active","past_due","grace","suspended","cancelled","expired","paused"] as const;

export function isSubscriptionStatus(v: unknown): v is SubscriptionStatus {
  return typeof v === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(v);
}

const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trial: ["active","cancelled","expired","past_due"],
  active: ["past_due","grace","suspended","cancelled","paused","expired"],
  past_due: ["grace","suspended","cancelled","active"],
  grace: ["suspended","cancelled","active"],
  suspended: ["cancelled","expired","active"],
  cancelled: ["expired"],
  expired: [],
  paused: ["active","cancelled"],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function computeMrr(plan: { monthlyPrice: number; annualPrice: number }, billingCycle: "monthly" | "yearly"): number {
  return billingCycle === "yearly" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
}

/** Revenue-generating statuses (matches saasMetrics MRR definition). Trials are free and never count as revenue. */
const REVENUE_STATUSES = ["active", "past_due", "grace"];

/** Statuses that trigger first-touch commission awards (never trials — no money has moved yet). */
const COMMISSION_STATUSES_SET = ["active", "past_due", "grace"];

/** Keep Organization.mrr in sync with the org's revenue-generating subscriptions. */
export async function syncOrgMrr(organizationId: string): Promise<number> {
  const agg = await prisma.subscription.aggregate({
    where: { organizationId, status: { in: REVENUE_STATUSES } },
    _sum: { mrr: true },
  });
  const mrr = agg._sum.mrr ?? 0;
  await prisma.organization.update({ where: { id: organizationId }, data: { mrr } });
  return mrr;
}

export async function listSubscriptions(opts?: { status?: string; planId?: string; orgId?: string; country?: string; currency?: string; billingCycle?: string; take?: number; skip?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.planId) where.planId = opts.planId;
  if (opts?.orgId) where.organizationId = opts.orgId;
  if (opts?.country) where.country = opts.country;
  if (opts?.currency) where.currency = opts.currency;
  if (opts?.billingCycle) where.billingCycle = opts.billingCycle;
  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: { plan: true, organization: { select: { legalName: true, businessName: true, country: true } } },
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    }),
    prisma.subscription.count({ where }),
  ]);
  return { items, total };
}

export async function getSubscription(id: string) {
  return prisma.subscription.findUnique({
    where: { id },
    include: { plan: true, organization: true, invoices: { include: { payments: true } } },
  });
}

export function validateSubscriptionInput(input: { organizationId?: string; planId?: string; billingCycle?: string; status?: string }): { ok: true } | { ok: false; error: string } {
  if (!input.organizationId) return { ok: false, error: "organizationId required" };
  if (!input.planId) return { ok: false, error: "planId required" };
  if (input.billingCycle && !["monthly","yearly"].includes(input.billingCycle)) return { ok: false, error: "billingCycle must be monthly|yearly" };
  if (input.status && !isSubscriptionStatus(input.status)) return { ok: false, error: "invalid status" };
  return { ok: true };
}

export interface SubscriptionPrice {
  country: string;
  currency: string;
  /** Recurring amount in `currency` UNITS (not cents) — as charged. */
  unitAmount: number | null;
  custom: boolean;
}

/**
 * Resolve the authoritative charged amount for a market-aware subscription.
 * - Explicit admin override wins (negotiated deals, incl. Enterprise).
 * - Otherwise the canonical PlanCountryPrice for (plan, country) applies.
 * - Contact-sales plans resolve to custom semantics (amount null unless
 *   explicitly negotiated).
 * Currency is always the market's catalog currency — never converted.
 */
export async function resolveSubscriptionPrice(opts: {
  planId: string;
  country: string;
  billingCycle: "monthly" | "yearly";
  unitAmountOverride?: number | null;
}): Promise<SubscriptionPrice> {
  const code = countryListing(opts.country)?.code ?? opts.country.trim().toUpperCase();
  const [plan, row] = await Promise.all([
    prisma.plan.findUnique({ where: { id: opts.planId } }),
    prisma.planCountryPrice.findUnique({ where: { planId_country: { planId: opts.planId, country: code } } }),
  ]);
  if (!plan) throw new Error("Plan not found");
  if (!plan.isActive || plan.archivedAt) throw new Error("Plan is inactive or archived");
  const listing = countryListing(code);
  const currency = listing?.currency ?? (code === "US" ? "USD" : "");
  if (!currency) throw new Error(`Unknown market "${code}"`);
  if (opts.unitAmountOverride !== undefined && opts.unitAmountOverride !== null) {
    const amt = Number(opts.unitAmountOverride);
    if (!Number.isFinite(amt) || amt < 0 || !Number.isInteger(amt)) throw new Error("price must be a non-negative integer in the market currency");
    return { country: code, currency, unitAmount: amt, custom: plan.isCustomPrice };
  }
  if (plan.isCustomPrice) return { country: code, currency, unitAmount: null, custom: true };
  if (row) {
    return { country: code, currency, unitAmount: opts.billingCycle === "yearly" ? row.annual : row.monthly, custom: false };
  }
  if (code === "US") {
    // US baseline fallback: billing cents ÷ 100 == storefront units.
    return { country: code, currency: "USD", unitAmount: Math.round((opts.billingCycle === "yearly" ? plan.annualPrice : plan.monthlyPrice) / 100), custom: false };
  }
  throw new Error(`No ${code} price configured for this plan`);
}

function addCycle(date: Date, cycle: "monthly" | "yearly"): Date {
  const d = new Date(date);
  const dom = d.getDate();
  if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  // Clamp month-end overflow (e.g. Jan 31 + 1mo → Mar 2/3 → Feb 28/29)
  if (d.getDate() !== dom) d.setDate(0);
  return d;
}

export async function createSubscription(input: {
  organizationId: string;
  planId: string;
  billingCycle?: "monthly" | "yearly";
  status?: SubscriptionStatus;
  trialEndsAt?: Date;
  /** Market (ISO2). Defaults to the org's own country when it is a known market. */
  country?: string;
  /** Optional explicit override of the charged amount (market-currency units). */
  unitAmount?: number | null;
  /** Period start ("Start Date"). */
  startAt?: Date;
}) {
  const v = validateSubscriptionInput(input);
  if (!v.ok) throw new Error(v.error);
  const billingCycle = input.billingCycle ?? "monthly";
  const [plan, org] = await Promise.all([
    prisma.plan.findUnique({ where: { id: input.planId } }),
    prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true, affiliateId: true, partnerId: true, country: true } }),
  ]);
  if (!plan) throw new Error("Plan not found");
  if (!org) throw new Error("Organization not found");
  if (!plan.isActive) throw new Error("Plan is inactive");

  const effectiveCountry = input.country ?? org.country ?? "US";
  const price = await resolveSubscriptionPrice({
    planId: input.planId,
    country: effectiveCountry,
    billingCycle,
    unitAmountOverride: input.unitAmount ?? undefined,
  });

  // Normalized USD-cents MRR metric (dashboards unchanged); the actually
  // charged currency/amount live on price.* and are never converted.
  // Negotiated USD deals are booked at their real charged amount; non-USD
  // markets keep the plan baseline (pricing is localized, not FX-converted).
  let mrr = computeMrr(plan, billingCycle);
  if (price.unitAmount !== null && price.currency === "USD") {
    const monthlyUnits = billingCycle === "yearly" ? Math.round(price.unitAmount / 12) : price.unitAmount;
    mrr = Math.max(0, Math.round(monthlyUnits * 100));
  }
  const now = new Date();
  const periodStart = input.startAt ?? now;
  const trialEndsAt = input.trialEndsAt ?? (input.status === "trial" ? new Date(now.getTime() + plan.trialDays * 86400000) : null);
  const initialStatus = input.status ?? "trial";
  const sub = await prisma.subscription.create({
    data: {
      organizationId: input.organizationId,
      planId: input.planId,
      billingCycle,
      status: initialStatus,
      mrr,
      country: price.country,
      currency: price.currency,
      unitAmount: price.unitAmount,
      currentPeriodStart: periodStart,
      currentPeriodEnd: addCycle(periodStart, billingCycle),
      trialEndsAt,
    },
    include: { plan: true, organization: true },
  });
  // Auto-create commission if org was acquired via affiliate or partner.
  // Only once real revenue starts — trials award nothing, and dedup inside
  // the creators makes repeat creates idempotent.
  if (COMMISSION_STATUSES_SET.includes(initialStatus)) {
    await awardFirstTouchCommission(org, input.organizationId, sub.id, mrr);
  }
  await syncOrgMrr(input.organizationId).catch(() => {});
  return sub;
}

/** First-touch commission award — affiliate wins over partner; dedup makes this idempotent. */
async function awardFirstTouchCommission(
  org: { affiliateId: string | null; partnerId: string | null },
  organizationId: string,
  subscriptionId: string,
  mrr: number,
): Promise<void> {
  try {
    if (org.affiliateId) {
      const { createCommissionForSubscription } = await import("./commissions");
      await createCommissionForSubscription({ affiliateId: org.affiliateId, organizationId, subscriptionId, mrr });
    } else if (org.partnerId) {
      const { createCommissionForPartnerSubscription } = await import("./partners");
      await createCommissionForPartnerSubscription({ partnerId: org.partnerId, organizationId, subscriptionId, mrr });
    }
  } catch {
    // Commission failure must never fail the subscription lifecycle action.
  }
}

export async function updateSubscriptionStatus(id: string, status: SubscriptionStatus) {
  if (!isSubscriptionStatus(status)) throw new Error("invalid status");
  const current = await prisma.subscription.findUnique({ where: { id }, select: { status: true, organizationId: true } });
  if (!current) throw new Error("Subscription not found");
  if (!canTransition(current.status as SubscriptionStatus, status)) throw new Error(`Cannot transition ${current.status} → ${status}`);
  const sub = await prisma.subscription.update({ where: { id }, data: { status } });
  if (status === "active") {
    // Trial → active (or reactivation): first revenue moment — award if not already awarded.
    const org = await prisma.organization.findUnique({
      where: { id: current.organizationId },
      select: { affiliateId: true, partnerId: true },
    });
    if (org) await awardFirstTouchCommission(org, current.organizationId, id, sub.mrr);
  }
  if (["active", "trial", "past_due", "grace", "cancelled", "expired", "suspended", "paused"].includes(status)) {
    await syncOrgMrr(current.organizationId).catch(() => {});
  }
  return sub;
}

export async function changePlan(id: string, planId: string, billingCycle?: "monthly" | "yearly") {
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw new Error("Subscription not found");
  const cycle = (billingCycle ?? existing.billingCycle) as "monthly" | "yearly";
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");
  // Re-resolve the charged amount for the subscription's own market so a plan
  // change never mixes another country's price into this subscription.
  // Only custom-priced plans legitimately have no catalog row — every other
  // resolution failure (archived/inactive/missing market price) must surface.
  const price = await resolveSubscriptionPrice({
    planId,
    country: existing.country,
    billingCycle: cycle,
    unitAmountOverride: null,
  }).catch((err: unknown) => {
    if (plan.isCustomPrice) {
      return { country: existing.country, currency: existing.currency, unitAmount: existing.unitAmount, custom: true };
    }
    throw err;
  });
  const mrr = computeMrr(plan, cycle);
  const sub = await prisma.subscription.update({
    where: { id },
    data: {
      planId,
      billingCycle: billingCycle ?? undefined,
      mrr,
      currency: price.currency,
      unitAmount: price.unitAmount,
    },
    include: { plan: true },
  });
  await syncOrgMrr(sub.organizationId).catch(() => {});
  return sub;
}

export async function renewSubscription(id: string) {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "cancelled" || sub.status === "expired") throw new Error("Cannot renew cancelled/expired");
  if (!["active", "past_due", "grace"].includes(sub.status)) {
    throw new Error(`Cannot renew a subscription in "${sub.status}" state`);
  }
  // Renewal extends a period that has (effectively) ended — it is not a way
  // to grant free service ahead of time. 24h skew tolerated for clock drift.
  if (sub.currentPeriodEnd.getTime() > Date.now() + 86_400_000) {
    throw new Error("Current period has not ended yet");
  }
  const nextEnd = addCycle(sub.currentPeriodEnd, sub.billingCycle as "monthly" | "yearly");
  const updated = await prisma.subscription.update({ where: { id }, data: { currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: nextEnd, status: "active" } });
  await syncOrgMrr(sub.organizationId).catch(() => {});
  return updated;
}
