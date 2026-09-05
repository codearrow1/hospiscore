/**
 * SaaS Platform Analytics — boundary (Phase K → P2 #23)
 * Drilldowns over SaaS subscriptions/orgs: revenue by country/plan,
 * acquisition by source, churn cohorts by month.
 */
import { prisma } from "@/lib/prisma";

export type Bucket = { key: string; customers: number; mrr: number };

const ACTIVE_ORG = "active";
const REVENUE_SUB_STATUS = ["active", "trial", "past_due", "grace"];

/** MRR + customer count grouped by org country (active orgs only). */
export async function revenueByCountry(): Promise<Bucket[]> {
  const orgs = await prisma.organization.findMany({
    where: { status: ACTIVE_ORG },
    select: { country: true, mrr: true },
  });
  const map = new Map<string, { customers: number; mrr: number }>();
  for (const o of orgs) {
    const key = o.country || "unknown";
    const cur = map.get(key) ?? { customers: 0, mrr: 0 };
    cur.customers += 1;
    cur.mrr += o.mrr;
    map.set(key, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.mrr - a.mrr);
}

/** MRR grouped by plan name across revenue-generating subscription statuses. */
export async function mrrByPlan(): Promise<Bucket[]> {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: REVENUE_SUB_STATUS } },
    include: { plan: { select: { name: true } } },
  });
  const map = new Map<string, { customers: number; mrr: number }>();
  for (const s of subs) {
    const cur = map.get(s.plan.name) ?? { customers: 0, mrr: 0 };
    cur.customers += 1;
    cur.mrr += s.mrr;
    map.set(s.plan.name, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.mrr - a.mrr);
}

/** New customers grouped by acquisitionSource with their current MRR. */
export async function acquisitionBySource(): Promise<Bucket[]> {
  const orgs = await prisma.organization.findMany({ select: { acquisitionSource: true, mrr: true, status: true } });
  const map = new Map<string, { customers: number; mrr: number }>();
  for (const o of orgs) {
    const key = o.acquisitionSource || "unattributed";
    const cur = map.get(key) ?? { customers: 0, mrr: 0 };
    cur.customers += 1;
    if (o.status === ACTIVE_ORG) cur.mrr += o.mrr;
    map.set(key, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.customers - a.customers);
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
