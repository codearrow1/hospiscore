import { prisma } from "@/lib/prisma";
import { listDunningCases } from "./dunning";
import { isSlaBreached, listTickets } from "./support";
import { listRequests } from "./planSync";

export type SaasMetrics = {
  generatedAt: string;
  mrr: number; // cents
  arr: number;
  totalCustomers: number;
  activeCustomers: number;
  newCustomers7d: number;
  newCustomersWindow: number;
  trials: number;
  trialConversion: number | null; // %
  churnRate: number | null;
  arpu: number | null; // cents
  ltv: number | null; // cents (ARPU / churn)
  activeProperties: number;
  totalProperties: number;
  mrrGrowth: { day: string; mrr: number }[];
  revenueByPlan: { plan: string; mrr: number; count: number }[];
  funnel: { stage: string; count: number; pct: number | null }[];
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function saasMetrics(windowDays = 14): Promise<SaasMetrics> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - Math.max(windowDays, 1) * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [orgCount, activeOrgCount, newOrg7dCount, newOrgWindowCount, activeSubCount, trialCount, cancelled30Count, mrrAgg, propCount, activePropCount] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: "active" } }),
    prisma.organization.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.organization.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.subscription.count({ where: { status: { in: ["active", "past_due", "grace"] } } }),
    prisma.subscription.count({ where: { status: "trial" } }),
    prisma.subscription.count({ where: { status: "cancelled", updatedAt: { gte: thirtyDaysAgo } } }),
    prisma.subscription.aggregate({ where: { status: { in: ["active", "past_due", "grace"] } }, _sum: { mrr: true } }),
    prisma.property.count(),
    prisma.property.count({ where: { status: "active" } }),
  ]);

  const totalCustomers = orgCount;
  const activeCustomers = activeOrgCount;
  const newCustomers7d = newOrg7dCount;
  const newCustomersWindow = newOrgWindowCount;

  const activeSubsCount = activeSubCount;
  const trials = trialCount;
  const cancelled30 = cancelled30Count;
  const mrr = mrrAgg._sum.mrr ?? 0;
  const arr = mrr * 12;
  const churnRate = activeSubsCount + cancelled30 > 0 ? Math.round((cancelled30 / (activeSubsCount + cancelled30)) * 1000) / 10 : null;
  const arpu = activeCustomers > 0 ? Math.round(mrr / activeCustomers) : null;
  const ltv = arpu != null && churnRate != null && churnRate > 0 ? Math.round((arpu / (churnRate / 100))) : null;

  // Trial conversion: trials that became active vs total trials created in last 30d
  const trials30 = await prisma.subscription.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: "trial" } });
  const converted30 = await prisma.subscription.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: "active" } });
  const trialConversion = trials30 > 0 ? Math.round((converted30 / Math.max(trials30, 1)) * 1000) / 10 : null;

  // MRR growth over the window — load only active subs once, compute in-memory
  const activeSubs = await prisma.subscription.findMany({
    where: { status: { in: ["active", "trial", "past_due", "grace"] } },
    select: { createdAt: true, mrr: true },
  });
  const mrrGrowth: { day: string; mrr: number }[] = [];
  const span = Math.max(Math.round(windowDays), 2);
  const start = new Date(now);
  start.setDate(start.getDate() - (span - 1));
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < span; i++) {
    const day = new Date(start.getTime() + i * 86400000);
    const key = dayKey(day).slice(5);
    const dayMrr = activeSubs
      .filter((s) => s.createdAt <= new Date(day.getTime() + 86400000))
      .reduce((sum, s) => sum + s.mrr, 0);
    mrrGrowth.push({ day: key, mrr: dayMrr });
  }

  // Revenue by plan using groupBy
  const planRows = await prisma.subscription.groupBy({
    by: ["planId"],
    where: { status: { in: ["active", "past_due", "grace"] } },
    _count: { _all: true },
    _sum: { mrr: true },
  });
  const planIds = planRows.map((r) => r.planId);
  const plans = planIds.length
    ? await prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
    : [];
  const planNameById = new Map(plans.map((p) => [p.id, p.name]));
  const revenueByPlan = planRows
    .map((r) => ({ plan: planNameById.get(r.planId) ?? "Unknown", mrr: r._sum.mrr ?? 0, count: r._count._all }))
    .sort((a, b) => b.mrr - a.mrr);

  // Funnel: use SQL counts
  const totalTrials = await prisma.subscription.count({ where: { status: { in: ["trial", "active", "past_due", "grace", "cancelled"] } } });
  const activePaid = await prisma.subscription.count({ where: { status: "active" } });
  const paidOrgCount = await prisma.organization.count({ where: { subscriptions: { some: { status: "active" } } } });
  const funnelRaw = [
    { stage: "Organizations", count: totalCustomers },
    { stage: "Trials", count: totalTrials },
    { stage: "Active", count: activePaid },
    { stage: "Paid Customers", count: paidOrgCount },
  ];
  const funnel = funnelRaw.map((f, i) => ({
    ...f,
    pct: i === 0 || funnelRaw[i - 1].count === 0 ? null : Math.round((f.count / funnelRaw[i - 1].count) * 1000) / 10,
  }));

  return {
    generatedAt: now.toISOString(),
    mrr,
    arr,
    totalCustomers,
    activeCustomers,
    newCustomers7d,
    newCustomersWindow,
    trials,
    trialConversion,
    churnRate,
    arpu,
    ltv,
    activeProperties: activePropCount,
    totalProperties: propCount,
    mrrGrowth,
    revenueByPlan,
    funnel,
  };
}

export function centsToLabel(cents: number | null): string {
  if (cents == null || cents === 0) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export type SaasOpsSummary = {
  outstandingArCents: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  dunningActiveCount: number;
  slaBreachedCount: number;
  pendingApprovalCount: number;
};

const OPEN_INVOICE_STATUSES = ["issued", "past_due", "partially_paid"];

/** Operational exceptions for the console overview (read-only, additive). */
export async function saasOpsSummary(): Promise<SaasOpsSummary> {
  const [invoices, payments, dunning, tickets, approvals] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: OPEN_INVOICE_STATUSES } },
      select: { id: true, amount: true, status: true, dueAt: true },
    }),
    prisma.payment.findMany({
      where: { invoiceId: { not: null }, status: "succeeded" },
      select: { invoiceId: true, amount: true },
    }),
    listDunningCases({ status: "active" }),
    listTickets(),
    listRequests("pending"),
  ]);

  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    if (!p.invoiceId) continue;
    paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + p.amount);
  }

  const now = Date.now();
  let outstandingArCents = 0;
  let overdueInvoiceCount = 0;
  for (const inv of invoices) {
    const remaining = inv.status === "partially_paid" ? Math.max(inv.amount - (paidByInvoice.get(inv.id) ?? 0), 0) : inv.amount;
    outstandingArCents += remaining;
    if (inv.status === "past_due" || (inv.dueAt && inv.dueAt.getTime() < now)) overdueInvoiceCount += 1;
  }

  return {
    outstandingArCents,
    openInvoiceCount: invoices.length,
    overdueInvoiceCount,
    dunningActiveCount: dunning.items.length,
    slaBreachedCount: tickets.items.filter(isSlaBreached).length,
    pendingApprovalCount: approvals.length,
  };
}
