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

/** Owner filter for the shared commission/payout ledger (affiliates and partners both live here). */
export type PayoutOwner = { affiliateId?: string | null; partnerId?: string | null };

function ownerWhere(owner: PayoutOwner) {
  if (owner.affiliateId) return { affiliateId: owner.affiliateId };
  if (owner.partnerId) return { partnerId: owner.partnerId };
  throw new Error("Payout owner required");
}

/**
 * Balance available for a new payout: sum of `payable` commissions
 * minus amounts already locked by open (not yet settled/failed) payouts.
 */
export async function availablePayoutBalance(owner: PayoutOwner): Promise<number> {
  const w = ownerWhere(owner);
  const [payable, open] = await Promise.all([
    prisma.affiliateCommission.aggregate({ where: { ...w, status: "payable" }, _sum: { amount: true } }),
    prisma.affiliatePayout.aggregate({ where: { ...w, status: { in: ["requested", "approved", "processing"] } }, _sum: { amount: true } }),
  ]);
  return (payable._sum.amount ?? 0) - (open._sum.amount ?? 0);
}

export async function createPayout(input: { affiliateId: string; amount: number; currency?: string; method?: string }) {
  if (input.amount <= 0) throw new Error("amount must be >0");
  const aff = await prisma.affiliate.findUnique({ where: { id: input.affiliateId } });
  if (!aff) throw new Error("Affiliate not found");
  const balance = await availablePayoutBalance({ affiliateId: input.affiliateId });
  if (input.amount > balance) {
    throw new Error(`Amount exceeds available payable balance (${balance})`);
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

/**
 * Marking a payout `paid` consumes the underlying `payable` commissions FIFO
 * so the same earnings can never fund a second payout.
 */
async function consumeCommissionsForPayout(payout: { amount: number } & PayoutOwner): Promise<number> {
  const w = payout.affiliateId ? { affiliateId: payout.affiliateId } : { partnerId: payout.partnerId };
  const rows = await prisma.affiliateCommission.findMany({
    where: { ...w, status: "payable" },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true },
  });
  let remaining = payout.amount;
  let consumed = 0;
  for (const row of rows) {
    if (remaining <= 0) break;
    remaining -= row.amount;
    const res = await prisma.affiliateCommission.updateMany({
      where: { id: row.id, status: "payable" },
      data: { status: "paid" },
    });
    consumed += res.count;
  }
  return consumed;
}

export async function updatePayoutStatus(id: string, to: PayoutStatus) {
  if (!PAYOUT_STATUSES.includes(to as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliatePayout.findUnique({ where: { id } });
  if (!cur) throw new Error("Payout not found");
  if (!canTransitionPayout(cur.status as PayoutStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);
  if (to === "paid" && cur.status !== "paid") {
    await consumeCommissionsForPayout(cur);
  }
  return prisma.affiliatePayout.update({ where: { id }, data: { status: to } });
}
