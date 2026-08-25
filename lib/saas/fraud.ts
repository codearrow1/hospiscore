/**
 * Affiliate Fraud Detection Engine — Phase G
 * Conservative, multi-signal fraud detection with manual review queue.
 * No auto-bans. Risk score + reasons → hold status → manual review.
 */

import { prisma } from "@/lib/prisma";

export type FraudStatus = "open" | "investigating" | "resolved" | "dismissed";
export const FRAUD_STATUSES = ["open","investigating","resolved","dismissed"] as const;

export type FraudResolution = "no_action" | "warning" | "commission_hold" | "account_suspend" | "account_terminate";
export const FRAUD_RESOLUTIONS = ["no_action","warning","commission_hold","account_suspend","account_terminate"] as const;

const ALLOWED: Record<FraudStatus, FraudStatus[]> = {
  open: ["investigating","resolved","dismissed"],
  investigating: ["resolved","dismissed"],
  resolved: [],
  dismissed: [],
};

export function canTransitionFraud(from: FraudStatus, to: FraudStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

interface FraudSignal {
  signal: string;
  weight: number; // 0-100
  detail: string;
}

/**
 * Run fraud detection checks on an affiliate. Returns risk score and flagged signals.
 * Does NOT create a fraud case — caller decides whether to flag.
 */
export async function detectFraud(affiliateId: string): Promise<{
  riskScore: number;
  signals: FraudSignal[];
  shouldFlag: boolean;
}> {
  const aff = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, email: true, createdAt: true },
  });
  if (!aff) throw new Error("Affiliate not found");

  const signals: FraudSignal[] = [];
  let totalWeight = 0;

  // Signal 1: Self-referral check — check if any commission references the affiliate's own org
  const selfRefOrgs = await prisma.organization.findMany({
    where: {
      OR: [
        { contacts: { some: { email: aff.email.toLowerCase() } } },
      ],
    },
    select: { id: true, legalName: true },
  });
  if (selfRefOrgs.length > 0) {
    signals.push({ signal: "self_referral_org", weight: 80, detail: `Affiliate email matches ${selfRefOrgs.length} organization(s)` });
    totalWeight += 80;
  }

  // Signal 2: Abnormal click→conversion ratio
  const [clickCount, commissionCount] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateCommission.count({ where: { affiliateId, amount: { gt: 0 } } }),
  ]);
  if (clickCount > 100 && commissionCount === 0) {
    signals.push({ signal: "no_conversions", weight: 30, detail: `${clickCount} clicks, 0 conversions` });
    totalWeight += 30;
  } else if (clickCount > 0 && commissionCount > 0) {
    const ratio = clickCount / commissionCount;
    if (ratio > 200) {
      signals.push({ signal: "low_conversion_rate", weight: 20, detail: `${clickCount} clicks / ${commissionCount} conversions = ${ratio.toFixed(1)}:1` });
      totalWeight += 20;
    }
  }

  // Signal 3: Immediate cancellation after commission
  const recentCommissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId, amount: { gt: 0 } },
    include: { subscription: { select: { status: true, cancelAt: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const c of recentCommissions) {
    if (c.subscription?.cancelAt && c.subscription?.createdAt) {
      const daysBetween = (c.subscription.cancelAt.getTime() - c.subscription.createdAt.getTime()) / 86400000;
      if (daysBetween < 7) {
        signals.push({ signal: "immediate_cancellation", weight: 50, detail: `Subscription cancelled after ${Math.round(daysBetween)} days` });
        totalWeight += 50;
        break;
      }
    }
  }

  // Signal 4: Multiple commissions from same IP (click spam)
  const ipGroupsRaw = await prisma.affiliateClick.groupBy({
    by: ["ip"],
    where: { affiliateId, ip: { not: null } },
    _count: { _all: true },
  });
  const ipGroups = ipGroupsRaw.filter(g => (g._count?._all ?? 0) > 50);
  if (ipGroups.length > 0) {
    signals.push({ signal: "ip_concentration", weight: 25, detail: `${ipGroups.length} IP(s) with 50+ clicks` });
    totalWeight += 25;
  }

  const riskScore = Math.min(totalWeight, 100);
  const shouldFlag = riskScore >= 50; // Conservative threshold

  return { riskScore, signals, shouldFlag };
}

/**
 * Create a fraud case for manual review.
 */
export async function createFraudCase(params: {
  affiliateId: string;
  riskScore: number;
  reasons: FraudSignal[];
}) {
  return prisma.affiliateFraudCase.create({
    data: {
      affiliateId: params.affiliateId,
      riskScore: params.riskScore,
      reasons: JSON.parse(JSON.stringify(params.reasons)),
      status: "open",
    },
  });
}

/**
 * Resolve a fraud case with an outcome.
 */
export async function resolveFraudCase(params: {
  id: string;
  status: FraudStatus;
  resolution?: FraudResolution;
  resolutionNote?: string;
  resolvedByEmail: string;
}) {
  if (!FRAUD_STATUSES.includes(params.status as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliateFraudCase.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!cur) throw new Error("Fraud case not found");
  if (!canTransitionFraud(cur.status as FraudStatus, params.status)) {
    throw new Error(`Cannot transition ${cur.status} → ${params.status}`);
  }

  const updateData: Record<string, unknown> = {
    status: params.status,
    resolvedByEmail: params.resolvedByEmail,
    resolvedAt: new Date(),
  };
  if (params.resolution) updateData.resolution = params.resolution;
  if (params.resolutionNote) updateData.resolutionNote = params.resolutionNote;

  const updated = await prisma.affiliateFraudCase.update({
    where: { id: params.id },
    data: updateData,
  });

  // Apply resolution action
  if (params.status === "resolved" && params.resolution) {
    await applyFraudResolution(updated.affiliateId, params.resolution);
  }

  return updated;
}

async function applyFraudResolution(affiliateId: string, resolution: FraudResolution) {
  switch (resolution) {
    case "account_suspend":
      await prisma.affiliate.update({ where: { id: affiliateId }, data: { status: "suspended" } });
      break;
    case "commission_hold":
      await prisma.affiliateCommission.updateMany({
        where: { affiliateId, status: { in: ["pending","eligible"] } },
        data: { status: "fraud_hold" },
      });
      break;
    // no_action, warning, account_terminate — logged but no auto-action for terminate
  }
}

export async function listFraudCases(opts?: { status?: string; affiliateId?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.affiliateId) where.affiliateId = opts.affiliateId;

  const [items, total] = await Promise.all([
    prisma.affiliateFraudCase.findMany({
      where,
      include: { affiliate: { select: { name: true, email: true, referralCode: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.affiliateFraudCase.count({ where }),
  ]);
  return { items, total };
}
