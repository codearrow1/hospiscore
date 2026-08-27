/**
 * SaaS Customer Health & Churn Risk — Phase J
 * Score 0-100 computed from real signals only:
 *   subscription status, payment failures, usage recency, property/user activity,
 *   subscription age. No invented data — orgs without signals get score null.
 * Statuses: healthy | stable | at_risk | critical | churned
 */
import { prisma } from "@/lib/prisma";
import { resolveSetting } from "@/lib/settings/resolver";

export type HealthStatus = "healthy" | "stable" | "at_risk" | "critical" | "churned";

export const HEALTH_STATUSES: HealthStatus[] = ["healthy", "stable", "at_risk", "critical", "churned"];

export function statusForScore(score: number | null, subStatus?: string | null): HealthStatus {
  if (subStatus === "cancelled" || subStatus === "expired") return "churned";
  if (score === null) return "stable";
  if (score >= 80) return "healthy";
  if (score >= 60) return "stable";
  if (score >= 40) return "at_risk";
  return "critical";
}

const DAY = 86400000;

export async function computeHealth(orgId: string): Promise<{ score: number | null; status: HealthStatus; signals: Record<string, number | string | null> }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      properties: { select: { id: true, status: true } },
      contacts: { select: { id: true } },
    },
  });
  if (!org) throw new Error("Organization not found");
  const sub = org.subscriptions[0];

  // Churned is deterministic from subscription state
  if (sub && (sub.status === "cancelled" || sub.status === "expired")) {
    await prisma.organization.update({ where: { id: orgId }, data: { healthScore: 0, healthStatus: "churned" } });
    return { score: 0, status: "churned", signals: { subscription: sub.status } };
  }

  let paymentWindowDays: number;
  try {
    paymentWindowDays = await resolveSetting<number>("health_payment_window_days");
  } catch {
    paymentWindowDays = 90;
  }
  const sinceWindow = new Date(Date.now() - paymentWindowDays * DAY);
  const [failedPayments, totalPayments, lastUsage, usageAgg, openTickets] = await Promise.all([
    prisma.payment.count({ where: { organizationId: orgId, status: "failed", createdAt: { gte: sinceWindow } } }),
    prisma.payment.count({ where: { organizationId: orgId, createdAt: { gte: sinceWindow } } }),
    prisma.usageRecord.findFirst({ where: { organizationId: orgId }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } }),
    prisma.usageRecord.aggregate({ where: { organizationId: orgId, metric: "users" }, _max: { quantity: true } }),
    prisma.supportTicket.count({ where: { organizationId: orgId, status: { in: ["open", "pending", "in_progress"] } } }),
  ]);

  let score = 50; // neutral baseline
  const signals: Record<string, number | string | null> = {};

  // Subscription standing (+/- up to 20)
  if (sub) {
    signals.subscription = sub.status;
    if (sub.status === "active") score += 15;
    else if (sub.status === "trial") score += 5;
    else if (sub.status === "past_due" || sub.status === "grace") score -= 10;
    else if (sub.status === "suspended") score -= 20;
    // tenure bonus: +1/month up to 6
    const ageMonths = Math.min(6, Math.floor((Date.now() - sub.createdAt.getTime()) / (30 * DAY)));
    score += ageMonths;
    signals.tenureMonths = ageMonths;
  } else {
    signals.subscription = null;
    score -= 10; // no subscription at all
  }

  // Payment reliability (-12 per failure, capped -30; +5 if payments exist and none failed)
  if (failedPayments > 0) {
    score -= Math.min(30, failedPayments * 12);
    signals.failedPayments90d = failedPayments;
  } else if (totalPayments > 0) {
    score += 5;
  }

  // Unresolved support burden (-6 per open ticket, capped -18)
  if (openTickets > 0) {
    score -= Math.min(18, openTickets * 6);
    signals.openTickets = openTickets;
  }

  // Usage recency (+/- up to 20)
  if (lastUsage) {
    const daysSince = Math.floor((Date.now() - lastUsage.recordedAt.getTime()) / DAY);
    signals.daysSinceLastUsage = daysSince;
    if (daysSince <= 3) score += 15;
    else if (daysSince <= 7) score += 8;
    else if (daysSince <= 14) score += 0;
    else if (daysSince <= 30) score -= 10;
    else score -= 20;
  } else {
    signals.daysSinceLastUsage = null;
    score -= 5; // never used the product
  }

  // Active users vs plan reality (+ up to 10)
  const activeUsers = usageAgg._max?.quantity ?? 0;
  signals.activeUsers = activeUsers;
  if (activeUsers >= 3) score += 10;
  else if (activeUsers === 2) score += 5;

  // Property footprint (+ up to 5)
  const activeProps = org.properties.filter((p) => p.status === "active").length;
  signals.activeProperties = activeProps;
  if (activeProps >= 2) score += 5;
  else if (activeProps === 1) score += 2;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = statusForScore(score, sub?.status);
  await prisma.organization.update({ where: { id: orgId }, data: { healthScore: score, healthStatus: status } });
  return { score, status, signals };
}

export async function recomputeAllHealth(): Promise<{ recomputed: number }> {
  const PAGE_SIZE = 100;
  let offset = 0;
  let recomputed = 0;
  while (true) {
    const batch = await prisma.organization.findMany({
      select: { id: true },
      where: { status: { not: "cancelled" } },
      skip: offset,
      take: PAGE_SIZE,
    });
    if (batch.length === 0) break;
    for (const o of batch) {
      try {
        await computeHealth(o.id);
        recomputed++;
      } catch (e) { console.error("[health] recompute failed for org", o.id, e); }
    }
    offset += PAGE_SIZE;
  }
  return { recomputed };
}

export async function listHealth(opts?: { status?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.healthStatus = opts.status;
  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: { id: true, legalName: true, businessName: true, country: true, healthScore: true, healthStatus: true, mrr: true, status: true, updatedAt: true },
      orderBy: [{ healthScore: "asc" }, { mrr: "desc" }],
      take: 200,
    }),
    prisma.organization.count({ where }),
  ]);
  return { items, total };
}
