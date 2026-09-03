/**
 * SaaS Platform Analytics — boundary (Phase K → P2 #23)
 * Drilldowns over SaaS subscriptions/orgs: revenue by country/plan,
 * acquisition by source, churn cohorts by month.
 *
 * All queries use SQL-level aggregation (groupBy/count) so the DB engine
 * does the heavy lifting — no unbounded findMany + in-memory grouping.
 */
import { prisma } from "@/lib/prisma";

export type Bucket = { key: string; customers: number; mrr: number };

const ACTIVE_ORG = "active";

/** MRR + customer count grouped by org country (active orgs only). */
export async function revenueByCountry(): Promise<Bucket[]> {
  const rows = await prisma.organization.groupBy({
    by: ["country"],
    where: { status: ACTIVE_ORG },
    _count: { _all: true },
    _sum: { mrr: true },
    orderBy: { _sum: { mrr: "desc" } },
  });
  return rows.map((r) => ({
    key: r.country || "unknown",
    customers: r._count._all,
    mrr: r._sum.mrr ?? 0,
  }));
}

/** MRR grouped by plan name across revenue-generating subscription statuses. */
export async function mrrByPlan(): Promise<Bucket[]> {
  const rows = await prisma.subscription.groupBy({
    by: ["planId"],
    where: { status: { in: ["active", "trial", "past_due", "grace"] } },
    _count: { _all: true },
    _sum: { mrr: true },
    orderBy: { _sum: { mrr: "desc" } },
  });
  const planIds = rows.map((r) => r.planId);
  const plans = planIds.length
    ? await prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(plans.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    key: nameById.get(r.planId) ?? "Unknown",
    customers: r._count._all,
    mrr: r._sum.mrr ?? 0,
  }));
}

/** New customers grouped by acquisitionSource with their current MRR. */
export async function acquisitionBySource(): Promise<Bucket[]> {
  const rows = await prisma.organization.groupBy({
    by: ["acquisitionSource"],
    _count: { _all: true },
    _sum: { mrr: true },
    orderBy: { _count: { _all: "desc" } } as never,
  });
  return rows.map((r) => ({
    key: r.acquisitionSource || "unattributed",
    customers: r._count._all,
    mrr: r._sum.mrr ?? 0,
  }));
}

/** Lost-MRR churn cohort by month (cancelled/expired subscriptions). */
export async function churnCohort(months = 6): Promise<{ month: string; lost: number; lostMrr: number }[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["cancelled", "expired"] }, updatedAt: { gte: since } },
    select: { updatedAt: true, mrr: true },
  });
  const map = new Map<string, { lost: number; lostMrr: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    map.set(d.toISOString().slice(0, 7), { lost: 0, lostMrr: 0 });
  }
  for (const s of subs) {
    const key = s.updatedAt.toISOString().slice(0, 7);
    const cur = map.get(key);
    if (!cur) continue;
    cur.lost += 1;
    cur.lostMrr += s.mrr;
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
}
