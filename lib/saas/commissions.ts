/**
 * SaaS Commissions — Phase G
 * Engine for affiliate/partner/franchise commissions with reversal policy.
 * States: pending → eligible → approved → payable → paid → (reversed/fraud_hold)
 * Reverses on: trial fraud, refund, chargeback, early cancellation per policy.
 */

import { prisma } from "@/lib/prisma";

export type CommissionStatus = "pending" | "eligible" | "approved" | "payable" | "paid" | "rejected" | "reversed" | "fraud_hold";
export const COMMISSION_STATUSES = ["pending","eligible","approved","payable","paid","rejected","reversed","fraud_hold"] as const;

const ALLOWED: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ["eligible","rejected","fraud_hold"],
  eligible: ["approved","rejected","fraud_hold","reversed"],
  approved: ["payable","rejected","reversed"],
  payable: ["paid","rejected","reversed"],
  paid: ["reversed"],
  rejected: [],
  reversed: [],
  fraud_hold: ["eligible","rejected","reversed"],
};

export function canTransitionCommission(from: CommissionStatus, to: CommissionStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function calcCommissionAmount(model: string, value: number, mrr: number): number {
  // value: cents for fixed, or basis points for percent (e.g. 2000 = 20%)
  switch (model) {
    case "fixed": return value;
    case "percent_first": return Math.round((mrr * value) / 10000);
    case "percent_mrr_12": return Math.round((mrr * value * 12) / 10000);
    case "percent_mrr_recurring": return Math.round((mrr * value) / 10000); // per month, caller aggregates
    default: return value;
  }
}

/** Award a first-touch commission. Idempotent per (affiliate, organization). */
export async function createCommissionForSubscription(params: {
  affiliateId: string;
  organizationId: string;
  subscriptionId: string;
  mrr: number;
}) {
  const aff = await prisma.affiliate.findUnique({ where: { id: params.affiliateId } });
  if (!aff) throw new Error("Affiliate not found");
  if (aff.status !== "active" && aff.status !== "approved") throw new Error("Affiliate not active");
  const dupe = await prisma.affiliateCommission.findFirst({
    where: { affiliateId: params.affiliateId, organizationId: params.organizationId, status: { notIn: ["reversed", "rejected"] } },
    select: { id: true },
  });
  if (dupe) return prisma.affiliateCommission.findUnique({ where: { id: dupe.id } });
  const amount = calcCommissionAmount(aff.commissionModel, aff.commissionValue, params.mrr);
  return prisma.affiliateCommission.create({
    data: {
      affiliateId: params.affiliateId,
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      amount,
      currency: "USD",
      status: "pending",
      model: aff.commissionModel,
    },
  });
}

export async function listCommissions(opts?: { affiliateId?: string; status?: string; organizationId?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.affiliateId) where.affiliateId = opts.affiliateId;
  if (opts?.status) where.status = opts.status;
  if (opts?.organizationId) where.organizationId = opts.organizationId;
  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({ where, include: { affiliate: { select: { name: true, email: true, referralCode: true } }, organization: { select: { legalName: true } }, subscription: { select: { plan: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.affiliateCommission.count({ where }),
  ]);
  return { items, total };
}

export async function updateCommissionStatus(id: string, to: CommissionStatus) {
  if (!COMMISSION_STATUSES.includes(to as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliateCommission.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw new Error("Commission not found");
  if (!canTransitionCommission(cur.status as CommissionStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);
  return prisma.affiliateCommission.update({ where: { id }, data: { status: to } });
}

export async function reverseCommission(id: string, reason?: string) {
  void reason; // reversal reason is captured in the audit log by callers
  const cur = await prisma.affiliateCommission.findUnique({ where: { id } });
  if (!cur) throw new Error("Commission not found");
  if (cur.status === "reversed" || cur.status === "paid") throw new Error("Cannot reverse paid/reversed");
  return prisma.affiliateCommission.update({ where: { id }, data: { status: "reversed" } });
}

// Called on refund/chargeback/early cancellation per policy — auto reverse if configured
export async function handleReversal(organizationId: string, subscriptionId: string) {
  const commissions = await prisma.affiliateCommission.findMany({ where: { organizationId, subscriptionId, status: { in: ["pending","eligible","approved","payable"] } } });
  for (const c of commissions) {
    await prisma.affiliateCommission.update({ where: { id: c.id }, data: { status: "reversed" } });
  }
  return commissions.length;
}
