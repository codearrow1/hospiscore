/**
 * Customer Subscription Self-Service — read-side assembler used by both the
 * /api/customer/subscription GET route and the /customer/subscription page.
 * No React logic here; all pricing/eligibility comes from canonical services.
 */
import { prisma } from "@/lib/prisma";
import { resolveSubscriptionPrice } from "@/lib/saas/subscriptions";
import { openSubscriptionChangeFor, listSubscriptionChangesForOrg } from "@/lib/saas/subscriptionPlan";
import { listPlans } from "@/lib/saas/plans";

const MANAGER_ROLES = ["owner", "billing"] as const;

export async function getCustomerSubscriptionOverview(orgId: string, contactId: string) {
  const contact = await prisma.orgContact.findUnique({ where: { id: contactId }, select: { role: true } });
  const isManager = contact != null && (MANAGER_ROLES as readonly string[]).includes(contact.role ?? "");

  const sub = await prisma.subscription.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  const [plans, properties, teamCount, openReq, history] = await Promise.all([
    listPlans(),
    prisma.property.count({ where: { organizationId: orgId } }),
    prisma.orgContact.count({ where: { organizationId: orgId } }),
    sub ? openSubscriptionChangeFor(sub.id) : Promise.resolve(null),
    listSubscriptionChangesForOrg(orgId),
  ]);

  const invoices: {
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    dueAt: Date | null;
    createdAt: Date;
  }[] = [];
  let outstanding = 0;
  let outstandingCurrency: string | null = null;
  if (sub) {
    const invs = await prisma.invoice.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { payments: true },
    });
    for (const inv of invs) {
      invoices.push({ id: inv.id, type: inv.type, status: inv.status, amount: inv.amount, currency: inv.currency, dueAt: inv.dueAt, createdAt: inv.createdAt });
      if (["issued", "past_due", "partially_paid"].includes(inv.status)) {
        outstanding += inv.amount - (inv.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0);
        outstandingCurrency = inv.currency ?? outstandingCurrency;
      }
    }
  }

  const eligiblePlans: {
    id: string;
    name: string;
    tagline: string | null;
    description: string | null;
    features: unknown;
    maxProperties: number | null;
    maxUsers: number | null;
    maxBookings: number | null;
    storageGb: number | null;
    customerPrice: number | null;
    currency: string | null;
    custom: boolean;
  }[] = [];
  if (sub) {
    for (const p of plans) {
      if (!p.isActive || p.archivedAt) continue;
      if (p.id === sub.planId) continue;
      let price;
      try {
        price = await resolveSubscriptionPrice({
          planId: p.id,
          country: sub.country,
          billingCycle: sub.billingCycle as "monthly" | "yearly",
        });
      } catch {
        continue;
      }
      eligiblePlans.push({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        features: p.features,
        maxProperties: p.maxProperties,
        maxUsers: p.maxUsers,
        maxBookings: p.maxBookings,
        storageGb: p.storageGb,
        customerPrice: price.unitAmount,
        currency: price.currency,
        custom: price.custom,
      });
    }
  }

  return {
    subscription: sub
      ? {
          id: sub.id,
          planId: sub.planId,
          planName: sub.plan?.name ?? null,
          status: sub.status,
          billingCycle: sub.billingCycle,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          trialEndsAt: sub.trialEndsAt,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          country: sub.country,
          currency: sub.currency,
          unitAmount: sub.unitAmount,
        }
      : null,
    plan: sub?.plan
      ? {
          maxProperties: sub.plan.maxProperties,
          maxUsers: sub.plan.maxUsers,
          maxBookings: sub.plan.maxBookings,
          storageGb: sub.plan.storageGb,
          features: sub.plan.features,
        }
      : null,
    usage: { properties, teamCount },
    outstanding: { amount: outstanding, currency: outstandingCurrency },
    openRequest: openReq
      ? {
          id: openReq.id,
          fromPlanId: openReq.fromPlanId,
          toPlanId: openReq.toPlanId,
          billingCycle: openReq.billingCycle,
          createdAt: openReq.createdAt,
          proposedSnapshot: openReq.proposedSnapshot,
        }
      : null,
    history: history.map((r) => ({
      id: r.id,
      fromPlanId: r.fromPlanId,
      toPlanId: r.toPlanId,
      status: r.status,
      createdAt: r.createdAt,
      reviewedByEmail: r.reviewedByEmail,
      rejectionReason: r.rejectionReason,
    })),
    invoices,
    eligiblePlans,
    isManager,
  };
}

export type CustomerSubscriptionOverview = Awaited<ReturnType<typeof getCustomerSubscriptionOverview>>;
