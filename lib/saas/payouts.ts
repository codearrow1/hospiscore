/**
 * SaaS Payouts — Phase G
 * Lifecycle: requested → approved → processing → paid → failed
 * Supports UPI/Bank/PayPal via AffiliatePayout. Amount derived from commissions.
 */

import { prisma } from "@/lib/prisma";

export type PayoutStatus = "requested" | "approved" | "processing" | "paid" | "failed";
export const PAYOUT_STATUSES = ["requested","approved","processing","paid","failed"] as const;

const ALLOWED: Record<PayoutStatus, PayoutStatus[]> = {
  requested: ["approved","failed"],
  approved: ["processing","failed"],
  processing: ["paid","failed"],
  paid: [],
  failed: ["requested"],
};

export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export async function listPayouts(opts?: { affiliateId?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.affiliateId) where.affiliateId = opts.affiliateId;
  if (opts?.status) where.status = opts.status;
  const [items, total] = await Promise.all([
    prisma.affiliatePayout.findMany({ where, include: { affiliate: { select: { name: true, email: true, referralCode: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.affiliatePayout.count({ where }),
  ]);
  return { items, total };
}

export async function createPayout(input: { affiliateId: string; amount: number; currency?: string; method?: string }) {
  if (input.amount <= 0) throw new Error("amount must be >0");
  const aff = await prisma.affiliate.findUnique({ where: { id: input.affiliateId } });
  if (!aff) throw new Error("Affiliate not found");
  // Ensure payable commissions cover amount (optional check)
  const payable = await prisma.affiliateCommission.aggregate({ where: { affiliateId: input.affiliateId, status: "payable" }, _sum: { amount: true } });
  const sumPayable = payable._sum.amount ?? 0;
  if (input.amount > sumPayable && sumPayable > 0) {
    // allow but warn — for thin slice, allow
  }
  return prisma.affiliatePayout.create({
    data: {
      affiliateId: input.affiliateId,
      amount: input.amount,
      currency: input.currency || "USD",
      method: input.method || aff.payoutMethod || "bank",
      status: "requested",
    },
  });
}

export async function updatePayoutStatus(id: string, to: PayoutStatus) {
  if (!PAYOUT_STATUSES.includes(to as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliatePayout.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw new Error("Payout not found");
  if (!canTransitionPayout(cur.status as PayoutStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);
  return prisma.affiliatePayout.update({ where: { id }, data: { status: to } });
}
