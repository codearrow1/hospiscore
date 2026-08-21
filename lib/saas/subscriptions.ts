import { prisma } from "@/lib/prisma";

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

/** Revenue-generating statuses (matches saasMetrics MRR definition). */
const REVENUE_STATUSES = ["active", "trial", "past_due", "grace"];

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

export async function listSubscriptions(opts?: { status?: string; planId?: string; orgId?: string; take?: number; skip?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.planId) where.planId = opts.planId;
  if (opts?.orgId) where.organizationId = opts.orgId;
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

export async function createSubscription(input: {
  organizationId: string;
  planId: string;
  billingCycle?: "monthly" | "yearly";
  status?: SubscriptionStatus;
  trialEndsAt?: Date;
}) {
  const v = validateSubscriptionInput(input);
  if (!v.ok) throw new Error(v.error);
  const [plan, org] = await Promise.all([
    prisma.plan.findUnique({ where: { id: input.planId } }),
    prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true, affiliateId: true, partnerId: true } }),
  ]);
  if (!plan) throw new Error("Plan not found");
  if (!org) throw new Error("Organization not found");
  if (!plan.isActive) throw new Error("Plan is inactive");
  const mrr = computeMrr(plan, input.billingCycle ?? "monthly");
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const trialEndsAt = input.trialEndsAt ?? (input.status === "trial" ? new Date(now.getTime() + plan.trialDays * 86400000) : null);
  const sub = await prisma.subscription.create({
    data: {
      organizationId: input.organizationId,
      planId: input.planId,
      billingCycle: input.billingCycle ?? "monthly",
      status: input.status ?? "trial",
      mrr,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
    },
    include: { plan: true, organization: true },
  });
  // Auto-create commission if org was acquired via affiliate or partner
  if (org.affiliateId) {
    try {
      const { createCommissionForSubscription } = await import("./commissions");
      await createCommissionForSubscription({ affiliateId: org.affiliateId, organizationId: input.organizationId, subscriptionId: sub.id, mrr });
    } catch {}
  } else if (org.partnerId) {
    try {
      const { createCommissionForPartnerSubscription } = await import("./partners");
      await createCommissionForPartnerSubscription({ partnerId: org.partnerId, organizationId: input.organizationId, subscriptionId: sub.id, mrr });
    } catch {}
  }
  await syncOrgMrr(input.organizationId).catch(() => {});
  return sub;
}

export async function updateSubscriptionStatus(id: string, status: SubscriptionStatus) {
  if (!isSubscriptionStatus(status)) throw new Error("invalid status");
  const current = await prisma.subscription.findUnique({ where: { id }, select: { status: true, organizationId: true } });
  if (!current) throw new Error("Subscription not found");
  if (!canTransition(current.status as SubscriptionStatus, status)) throw new Error(`Cannot transition ${current.status} → ${status}`);
  const sub = await prisma.subscription.update({ where: { id }, data: { status } });
  if (["active", "trial", "past_due", "grace", "cancelled", "expired", "suspended", "paused"].includes(status)) {
    await syncOrgMrr(current.organizationId).catch(() => {});
  }
  return sub;
}

export async function changePlan(id: string, planId: string, billingCycle?: "monthly" | "yearly") {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");
  if (!plan.isActive) throw new Error("Plan is inactive");
  const mrr = computeMrr(plan, billingCycle ?? "monthly");
  const sub = await prisma.subscription.update({
    where: { id },
    data: { planId, billingCycle: billingCycle ?? undefined, mrr },
    include: { plan: true },
  });
  await syncOrgMrr(sub.organizationId).catch(() => {});
  return sub;
}

export async function renewSubscription(id: string) {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "cancelled" || sub.status === "expired") throw new Error("Cannot renew cancelled/expired");
  const nextEnd = new Date(sub.currentPeriodEnd);
  nextEnd.setMonth(nextEnd.getMonth() + 1);
  const updated = await prisma.subscription.update({ where: { id }, data: { currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: nextEnd, status: "active" } });
  await syncOrgMrr(sub.organizationId).catch(() => {});
  return updated;
}
