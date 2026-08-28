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

/** Booked MRR for a resolved charged price — single source of truth for create and changePlan. */
function mrrFromPrice(
  plan: { monthlyPrice: number; annualPrice: number },
  billingCycle: "monthly" | "yearly",
  price: { unitAmount: number | null; currency: string },
): number {
  let mrr = computeMrr(plan, billingCycle);
  if (price.unitAmount !== null && price.currency === "USD") {
    const monthlyUnits = billingCycle === "yearly" ? Math.round(price.unitAmount / 12) : price.unitAmount;
    mrr = Math.max(0, Math.round(monthlyUnits * 100));
  }
  return mrr;
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

/**
 * Signed mid-period plan-change delta in minor units (pure; tests).
 * Both prices are normalized to monthly equivalents so monthly↔yearly
 * switches prorate fairly over the SAME remaining window, then scaled by the
 * unused fraction of the current period.
 */
export function prorationDeltaMinor(opts: {
  oldUnitAmount: number;
  newUnitAmount: number;
  oldCycle: "monthly" | "yearly";
  newCycle: "monthly" | "yearly";
  periodStartMs: number;
  periodEndMs: number;
  nowMs: number;
}): number {
  const total = opts.periodEndMs - opts.periodStartMs;
  if (!Number.isFinite(total) || total <= 0) return 0;
  const rawRemaining = opts.periodEndMs - opts.nowMs;
  if (!Number.isFinite(rawRemaining) || rawRemaining <= 0) return 0;
  const remaining = Math.min(rawRemaining, total);
  const oldMonthly = opts.oldCycle === "yearly" ? opts.oldUnitAmount / 12 : opts.oldUnitAmount;
  const newMonthly = opts.newCycle === "yearly" ? opts.newUnitAmount / 12 : opts.newUnitAmount;
  return Math.round(((newMonthly - oldMonthly) * remaining * 100) / total);
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
  const mrr = mrrFromPrice(plan, billingCycle, price);
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

export async function changePlan(
  id: string,
  planId: string,
  billingCycle?: "monthly" | "yearly",
  actorEmail = "system",
) {
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw new Error("Subscription not found");
  const cycle = (billingCycle ?? existing.billingCycle) as "monthly" | "yearly";
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  // Preserve negotiated pricing across plan changes: when the subscription's
  // charged amount differs from its own plan/market/cycle catalog price, that
  // amount is an explicit deal — carry it onto the new plan. Catalog-priced
  // subscriptions re-resolve fresh from the new plan's catalog instead.
  // A billing-cycle switch always re-resolves from catalog unless the caller
  // supplies an explicit override, because per-cycle amounts are not
  // interchangeable (monthly deals don't map onto yearly prices).
  let unitAmountOverride: number | null | undefined;
  if (cycle === existing.billingCycle && existing.unitAmount != null) {
    const currentCatalog = await resolveSubscriptionPrice({
      planId: existing.planId,
      country: existing.country,
      billingCycle: cycle,
      unitAmountOverride: null,
    }).catch(() => null);
    const negotiated = !currentCatalog || currentCatalog.unitAmount !== existing.unitAmount;
    unitAmountOverride = negotiated ? existing.unitAmount : null;
  }

  // Re-resolve the charged amount for the subscription's own market so a plan
  // change never mixes another country's price into this subscription.
  // Only custom-priced plans legitimately have no catalog row — every other
  // resolution failure (archived/inactive/missing market price) must surface.
  const price = await resolveSubscriptionPrice({
    planId,
    country: existing.country,
    billingCycle: cycle,
    unitAmountOverride,
  }).catch((err: unknown) => {
    if (plan.isCustomPrice) {
      return { country: existing.country, currency: existing.currency, unitAmount: existing.unitAmount, custom: true };
    }
    throw err;
  });
  const mrr = mrrFromPrice(plan, cycle, price);
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

  // Mid-period proration (M-04): upgrading within a paid period charges the
  // positive delta for the remaining window as a dedicated invoice. Negative
  // deltas are audit-visible but produce no credit (no credit model yet).
  if (
    REVENUE_STATUSES.includes(existing.status) &&
    existing.unitAmount != null &&
    price.unitAmount != null &&
    existing.currency === price.currency
  ) {
    const delta = prorationDeltaMinor({
      oldUnitAmount: existing.unitAmount,
      newUnitAmount: price.unitAmount,
      oldCycle: existing.billingCycle as "monthly" | "yearly",
      newCycle: cycle,
      periodStartMs: existing.currentPeriodStart.getTime(),
      periodEndMs: existing.currentPeriodEnd.getTime(),
      nowMs: Date.now(),
    });
    if (delta > 0) {
      try {
        const { createInvoice } = await import("./gateway");
        await createInvoice({
          organizationId: existing.organizationId,
          subscriptionId: id,
          amount: delta,
          currency: price.currency,
          type: "proration",
          dueAt: existing.currentPeriodEnd,
          actorEmail,
        });
      } catch {
        // Proration billing must not roll back an approved plan change.
      }
    }
  }
  return sub;
}

export async function renewSubscription(id: string, actorEmail = "system:cron") {
  const { createInvoice } = await import("./gateway");

  // The whole renewal — state checks, outstanding-invoice gate, next-period
  // invoice, period extension — runs in ONE transaction so two concurrent
  // renewals cannot both observe the same ended period and double-extend /
  // double-invoice. SQLite's single-writer locking serializes contenders.
  let syncedOrgId: string | null = null;
  const result = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { id } });
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
    // Settle-first rule (M-05): no new service period while money for the old
    // one is still owed — that path belongs to dunning/recovery.
    const outstanding = await tx.invoice.count({
      where: { subscriptionId: id, status: { in: ["issued", "past_due", "partially_paid"] } },
    });
    if (outstanding > 0) {
      throw new Error(`Cannot renew with ${outstanding} unsettled invoice(s) — collect or void first`);
    }

    // Charged amount in the market's minor units; USD-baseline fallback books
    // the normalized MRR cents when a negotiated/custom amount was never set.
    const amountMinor = sub.unitAmount != null ? sub.unitAmount * 100 : sub.mrr;

    // Repeating/forever coupon re-application (M-07): pick up the org's
    // existing redemption and let applyCoupon(mode:"renewal") enforce
    // duration limits exactly (inside this same transaction).
    let couponCode: string | undefined;
    if (amountMinor > 0) {
      const candidates = await tx.couponRedemption.findMany({
        where: { organizationId: sub.organizationId, coupon: { isActive: true, duration: { in: ["repeating", "forever"] } } },
        include: { coupon: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      });
      const usable = candidates.find((r) => {
        if (r.coupon.expiresAt && r.coupon.expiresAt.getTime() <= Date.now()) return false;
        if (r.coupon.planId && r.coupon.planId !== sub.planId) return false;
        return r.coupon.duration === "forever" || r.coupon.duration === "repeating";
      });
      if (usable) couponCode = usable.coupon.code;
    }

    // Invoice FIRST — if billing setup fails, service must not silently extend.
    const invoice = await createInvoice(
      {
        organizationId: sub.organizationId,
        subscriptionId: id,
        amount: amountMinor,
        currency: sub.currency ?? "USD",
        type: "subscription",
        dueAt: sub.currentPeriodEnd,
        couponCode,
        couponMode: "renewal",
        actorEmail,
      },
      tx,
    );

    const nextEnd = addCycle(sub.currentPeriodEnd, sub.billingCycle as "monthly" | "yearly");
    // Claim the exact observed period end AT WRITE TIME: if another renewal
    // committed after our (stale) gate reads, this matches 0 rows and the
    // whole transaction — invoice included — rolls back.
    const claimed = await tx.subscription.updateMany({
      where: { id, currentPeriodEnd: sub.currentPeriodEnd },
      data: { currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: nextEnd, status: "active" },
    });
    if (claimed.count === 0) throw new Error("Renewal raced with another renewal — aborted");
    const updated = await tx.subscription.findUniqueOrThrow({ where: { id } });
    syncedOrgId = sub.organizationId;
    return Object.assign(updated, { renewalInvoiceId: invoice.id, renewalInvoiceAmount: invoice.amount });
  }, { maxWait: 20_000, timeout: 60_000 });
  // Denormalized MRR counter — safe (and correct) to refresh post-commit.
  if (syncedOrgId) await syncOrgMrr(syncedOrgId).catch(() => {});
  return result;
}

/**
 * End-of-period (scheduled) cancellation: the subscription keeps serving in
 * its current revenue state until `currentPeriodEnd` and then transitions to
 * cancelled (via expireScheduledCancellations). Never cancels a suspended,
 * cancelled or expired subscription — those are not serviceable.
 */
export async function scheduleCancellation(id: string, _actorEmail = "customer") {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new Error("Subscription not found");
  if (["cancelled", "expired", "suspended"].includes(sub.status)) {
    throw new Error(`Cannot schedule cancellation while subscription is "${sub.status}"`);
  }
  const updated = await prisma.subscription.update({
    where: { id },
    data: { cancelAtPeriodEnd: true, cancelAt: sub.currentPeriodEnd },
  });
  return updated;
}

/**
 * Reverse a scheduled cancellation (while still active) or resume a paused
 * subscription. A subscription that has already reached `cancelled` cannot be
 * resumed (the state machine has no cancelled→active edge).
 */
export async function resumeSubscription(id: string, _actorEmail = "customer") {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "cancelled" || sub.status === "expired") {
    throw new Error(`Cannot resume a "${sub.status}" subscription`);
  }
  if (sub.cancelAtPeriodEnd) {
    return prisma.subscription.update({
      where: { id },
      data: { cancelAtPeriodEnd: false, cancelAt: null },
    });
  }
  if (sub.status === "paused") {
    const revived = await updateSubscriptionStatus(id, "active");
    await prisma.subscription.update({
      where: { id },
      data: { cancelAtPeriodEnd: false, cancelAt: null },
    });
    return revived;
  }
  throw new Error("Nothing to resume — the subscription has no scheduled cancellation and is not paused");
}

/** Terminal transition for scheduled-cancellation subscriptions whose period has ended. */
export async function expireScheduledCancellations(now = new Date()): Promise<number> {
  const due = await prisma.subscription.findMany({
    where: {
      cancelAtPeriodEnd: true,
      status: { in: ["trial", "active", "past_due", "grace", "paused"] },
      currentPeriodEnd: { lte: now },
    },
    select: { id: true, organizationId: true },
  });
  for (const s of due) {
    await prisma.subscription.updateMany({
      where: { id: s.id },
      data: { status: "cancelled", cancelAtPeriodEnd: false },
    });
    await syncOrgMrr(s.organizationId).catch(() => {});
  }
  return due.length;
}
