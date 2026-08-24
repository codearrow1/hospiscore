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

  const [orgs, subs, props] = await Promise.all([
    prisma.organization.findMany({ select: { id: true, createdAt: true, status: true } }),
    prisma.subscription.findMany({ include: { plan: true } }),
    prisma.property.findMany({ select: { id: true, status: true } }),
  ]);

  const totalCustomers = orgs.length;
  const activeCustomers = orgs.filter((o) => o.status === "active").length;
  const newCustomers7d = orgs.filter((o) => o.createdAt >= sevenDaysAgo).length;
  const newCustomersWindow = orgs.filter((o) => o.createdAt >= windowStart).length;

  const activeSubs = subs.filter((s) => ["active", "past_due", "grace"].includes(s.status));
  const trials = subs.filter((s) => s.status === "trial").length;
  const cancelled30 = subs.filter((s) => s.status === "cancelled" && s.updatedAt >= thirtyDaysAgo).length;
  const mrr = activeSubs.reduce((sum, s) => sum + s.mrr, 0);
  const arr = mrr * 12;
  const churnRate = activeSubs.length + cancelled30 > 0 ? Math.round((cancelled30 / (activeSubs.length + cancelled30)) * 1000) / 10 : null;
  const arpu = activeCustomers > 0 ? Math.round(mrr / activeCustomers) : null;
  const ltv = arpu != null && churnRate != null && churnRate > 0 ? Math.round((arpu / (churnRate / 100))) : null;

  // Trial conversion: trials that became active vs total trials created in last 30d
  const trials30 = subs.filter((s) => s.createdAt >= thirtyDaysAgo && s.status === "trial").length;
  const converted = subs.filter((s) => s.createdAt >= thirtyDaysAgo && s.status === "active").length;
  const trialConversion = trials30 > 0 ? Math.round((converted / Math.max(trials30, 1)) * 1000) / 10 : null;

  // MRR growth over the window (simplified: cumulative MRR of subs created each day)
  const mrrGrowth: { day: string; mrr: number }[] = [];
  const span = Math.max(Math.round(windowDays), 2);
  const start = new Date(now);
  start.setDate(start.getDate() - (span - 1));
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < span; i++) {
    const day = new Date(start.getTime() + i * 86400000);
    const key = dayKey(day).slice(5);
    const daySubs = subs.filter((s) => s.createdAt <= new Date(day.getTime() + 86400000) && ["active", "trial", "past_due", "grace"].includes(s.status));
    const dayMrr = daySubs.reduce((sum, s) => sum + s.mrr, 0);
    mrrGrowth.push({ day: key, mrr: dayMrr });
  }

  const byPlan = new Map<string, { mrr: number; count: number }>();
  for (const s of activeSubs) {
    const key = s.plan.name;
    const cur = byPlan.get(key) ?? { mrr: 0, count: 0 };
    cur.mrr += s.mrr;
    cur.count += 1;
    byPlan.set(key, cur);
  }
  const revenueByPlan = [...byPlan.entries()].map(([plan, v]) => ({ plan, ...v })).sort((a, b) => b.mrr - a.mrr);

  // Funnel: Visitors (pageViews) → Leads → Trials → Active Customers
  // Use orgs as proxy for customers, subs for trials/active. Visitors approximated from pageViews if available.
  const totalTrials = subs.filter((s) => ["trial", "active", "past_due", "grace", "cancelled"].includes(s.status)).length;
  const funnelRaw = [
    { stage: "Organizations", count: totalCustomers },
    { stage: "Trials", count: totalTrials },
    { stage: "Active", count: activeSubs.filter((s) => s.status === "active").length },
    { stage: "Paid Customers", count: orgs.filter((o) => subs.some((s) => s.organizationId === o.id && s.status === "active")).length },
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
    activeProperties: props.filter((p) => p.status === "active").length,
    totalProperties: props.length,
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
