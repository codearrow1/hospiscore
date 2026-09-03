/**
 * Franchise payout settlement run.
 * Calculates actual franchisee payouts from territory MRR for a given period.
 */
import { prisma } from "@/lib/prisma";

export interface SettlementResult {
  franchiseeId: string;
  company: string;
  period: string;
  grossAmount: number;
  shareBps: number;
  netAmount: number;
  currency: string;
  created: boolean; // false if already settled for this period
}

/**
 * Run settlement for a given period (YYYY-MM).
 * For each active franchisee with active territories, sum their territory MRR
 * (per record currency) and create a FranchisePayout row at their contracted share.
 * Idempotent: skips franchisees already settled for the period.
 */
export async function runSettlement(period: string): Promise<SettlementResult[]> {
  // Validate period format
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Period must be YYYY-MM");

  // Get all active franchisees with their share rate
  const franchisees = await prisma.franchisee.findMany({
    where: { status: { in: ["active", "signed"] } },
    select: { id: true, company: true, revenueShareBps: true },
  });
  if (franchisees.length === 0) return [];

  // Get territory → franchisee mapping
  const territories = await prisma.franchiseTerritory.findMany({
    where: { franchiseeId: { not: null }, status: "active" },
    select: { id: true, franchiseeId: true },
  });
  const terrToF = new Map<string, string>();
  for (const t of territories) {
    if (t.franchiseeId) terrToF.set(t.id, t.franchiseeId);
  }

  // Get all orgs in territories
  const orgs = await prisma.organization.findMany({
    where: { franchiseTerritoryId: { not: null } },
    select: { id: true, franchiseTerritoryId: true },
  });

  // Get active subscriptions grouped by org + currency
  const subs = await prisma.subscription.groupBy({
    by: ["organizationId", "currency"],
    where: { status: { in: ["active", "trial", "past_due", "grace"] } },
    _sum: { mrr: true },
  });

  // Build MRR per territory per currency
  const mrrByOrg = new Map<string, Map<string, number>>();
  for (const s of subs) {
    const cur = s.currency || "USD";
    const inner = mrrByOrg.get(s.organizationId) ?? new Map<string, number>();
    inner.set(cur, (inner.get(cur) ?? 0) + (s._sum.mrr ?? 0));
    mrrByOrg.set(s.organizationId, inner);
  }

  // Aggregate to franchisee level
  const mrrByFranchisee = new Map<string, Map<string, number>>();
  for (const o of orgs) {
    if (!o.franchiseTerritoryId) continue;
    const fId = terrToF.get(o.franchiseTerritoryId);
    if (!fId) continue;
    const inner = mrrByOrg.get(o.id);
    if (!inner) continue;
    const bucket = mrrByFranchisee.get(fId) ?? new Map<string, number>();
    for (const [cur, cents] of inner) bucket.set(cur, (bucket.get(cur) ?? 0) + cents);
    mrrByFranchisee.set(fId, bucket);
  }

  // Check which franchisees already have payouts for this period
  const existing = await prisma.franchisePayout.findMany({
    where: { period },
    select: { franchiseeId: true },
  });
  const settled = new Set(existing.map((e) => e.franchiseeId));

  const results: SettlementResult[] = [];
  for (const f of franchisees) {
    if (settled.has(f.id)) {
      results.push({ franchiseeId: f.id, company: f.company, period, grossAmount: 0, shareBps: f.revenueShareBps, netAmount: 0, currency: "USD", created: false });
      continue;
    }
    const bucket = mrrByFranchisee.get(f.id);
    if (!bucket || bucket.size === 0) {
      results.push({ franchiseeId: f.id, company: f.company, period, grossAmount: 0, shareBps: f.revenueShareBps, netAmount: 0, currency: "USD", created: false });
      continue;
    }
    // Pick dominant currency for the payout record
    const entries = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
    const [currency, grossCents] = entries[0];
    const netCents = Math.round((grossCents * f.revenueShareBps) / 10000);

    await prisma.franchisePayout.create({
      data: {
        franchiseeId: f.id,
        period,
        grossAmount: grossCents,
        shareBps: f.revenueShareBps,
        netAmount: netCents,
        currency,
        status: "draft",
      },
    });
    results.push({ franchiseeId: f.id, company: f.company, period, grossAmount: grossCents, shareBps: f.revenueShareBps, netAmount: netCents, currency, created: true });
  }

  return results;
}

/** List payouts, optionally filtered by franchisee or period. */
export async function listFranchisePayouts(opts?: { franchiseeId?: string; period?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.franchiseeId) where.franchiseeId = opts.franchiseeId;
  if (opts?.period) where.period = opts.period;
  if (opts?.status) where.status = opts.status;
  return prisma.franchisePayout.findMany({
    where,
    include: { franchisee: { select: { company: true, contactName: true, email: true } } },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}
