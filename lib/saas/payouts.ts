/**
 * SaaS Payouts — Phase G
 * Lifecycle: requested → approved → processing → paid → failed
 * Supports UPI/Bank/PayPal via AffiliatePayout. Amount derived from commissions.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export type PayoutStatus = "requested" | "approved" | "processing" | "paid" | "failed";
export const PAYOUT_STATUSES = ["requested","approved","processing","paid","failed"] as const;

/** Transaction client type so balance checks can run inside the same transaction as their write. */
export type PayoutTx = Prisma.TransactionClient;

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
 * Balance available for a new payout: sum of the UNCONSUMED remainder of
 * `payable` commissions (`amount - paidAmount`) minus amounts already locked
 * by open (not yet settled/failed) payouts. Partially consumed rows from a
 * prior settled payout must not count twice — only their remainder does.
 */
export async function availablePayoutBalance(owner: PayoutOwner, tx?: PayoutTx): Promise<number> {
  const w = ownerWhere(owner);
  const db = tx ?? prisma;
  const [payableRows, open] = await Promise.all([
    db.affiliateCommission.findMany({
      where: { ...w, status: "payable" },
      select: { amount: true, paidAmount: true },
    }),
    db.affiliatePayout.aggregate({ where: { ...w, status: { in: ["requested", "approved", "processing"] } }, _sum: { amount: true } }),
  ]);
  const unconsumed = payableRows.reduce((sum, r) => sum + Math.max(0, r.amount - r.paidAmount), 0);
  return unconsumed - (open._sum.amount ?? 0);
}

export async function createPayout(input: { affiliateId: string; amount: number; currency?: string; method?: string }) {
  // Fractional amounts would silently truncate against the Int column — round
  // once here so the balance check sees exactly what will be stored.
  const amount = Math.round(Number(input.amount));
  if (!(amount > 0)) throw new Error("amount must be >0");
  if (!Number.isFinite(amount)) throw new Error("amount must be a finite number");
  const aff = await prisma.affiliate.findUnique({ where: { id: input.affiliateId } });
  if (!aff) throw new Error("Affiliate not found");
  // Balance check and creation share one transaction — two concurrent payout
  // requests can no longer both pass the check against the same payable sum.
  return prisma.$transaction(async (tx) => {
    const balance = await availablePayoutBalance({ affiliateId: input.affiliateId }, tx);
    if (amount > balance) {
      throw new Error(`Amount exceeds available payable balance (${balance})`);
    }
    return tx.affiliatePayout.create({
      data: {
        affiliateId: input.affiliateId,
        amount,
        currency: input.currency || "USD",
        method: input.method || aff.payoutMethod || "bank",
        status: "requested",
      },
    });
  }, { maxWait: 20_000, timeout: 60_000 });
}

/**
 * Marking a payout `paid` consumes the underlying `payable` commissions FIFO
 * so the same earnings can never fund a second payout. Consumption is partial:
 * `paidAmount` tracks exactly how much of each row this payout consumed, so
 * sum(consumed) always equals the payout amount (never over- or under-consumes).
 */
async function consumeCommissionsForPayout(payout: { amount: number } & PayoutOwner, tx?: PayoutTx): Promise<number> {
  const w = payout.affiliateId ? { affiliateId: payout.affiliateId } : { partnerId: payout.partnerId };
  const db = tx ?? prisma;
  const rows = await db.affiliateCommission.findMany({
    where: { ...w, status: "payable" },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, paidAmount: true },
  });
  let remaining = payout.amount;
  let consumedRows = 0;
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, row.amount - row.paidAmount);
    if (take <= 0) continue;
    const fullyConsumed = row.paidAmount + take >= row.amount;
    const res = await db.affiliateCommission.updateMany({
      where: { id: row.id, status: "payable" },
      data: {
        paidAmount: { increment: take },
        ...(fullyConsumed ? { status: "paid" } : {}),
      },
    });
    if (res.count === 0) continue; // lost a concurrent claim — skip to next row
    remaining -= take;
    consumedRows++;
  }
  if (remaining > 0) {
    throw new Error(
      `Payable commissions fell short by ${remaining} while settling payout — ledger drift detected`,
    );
  }
  return consumedRows;
}

export async function updatePayoutStatus(id: string, to: PayoutStatus) {
  if (!PAYOUT_STATUSES.includes(to as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliatePayout.findUnique({ where: { id } });
  if (!cur) throw new Error("Payout not found");
  if (!canTransitionPayout(cur.status as PayoutStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);
  // The processing→paid settlement claims the row atomically inside the same
  // transaction as consumption, so a payout can never be marked paid twice.
  await prisma.$transaction(async (tx) => {
    if (to === "paid") {
      const claimed = await tx.affiliatePayout.updateMany({
        where: { id, status: cur.status },
        data: { status: "paid" },
      });
      if (claimed.count === 0) throw new Error(`Cannot transition ${cur.status} → paid`);
      await consumeCommissionsForPayout(cur, tx);
      return;
    }
    await tx.affiliatePayout.update({ where: { id }, data: { status: to } });
  }, { maxWait: 20_000, timeout: 60_000 });
  return prisma.affiliatePayout.findUniqueOrThrow({ where: { id } });
}
