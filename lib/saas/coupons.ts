/**
 * Coupons / Promotions — Phase L
 * percent (bps) or fixed (cents) discounts; once | repeating | forever duration.
 * One redemption per org per coupon. Discounts are computed at invoice creation
 * and recorded immutably in CouponRedemption.
 */
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/lib/generated/prisma/client";

export type CouponType = "percent" | "fixed";
export type CouponDuration = "once" | "repeating" | "forever";

function genCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function validateCouponInput(input: { code?: string; type?: string; value?: number; duration?: string; months?: number | null; maxRedemptions?: number | null }): { ok: true } | { ok: false; error: string } {
  if (!input.type || !["percent", "fixed"].includes(input.type)) return { ok: false, error: "type must be percent|fixed" };
  if (typeof input.value !== "number" || input.value <= 0) return { ok: false, error: "value must be positive" };
  if (input.type === "percent" && input.value > 10000) return { ok: false, error: "percent value cannot exceed 10000 bps" };
  if (!input.duration || !["once", "repeating", "forever"].includes(input.duration)) return { ok: false, error: "duration must be once|repeating|forever" };
  if (input.duration === "repeating" && (!input.months || input.months < 1 || input.months > 36)) return { ok: false, error: "repeating requires months 1-36" };
  if (input.maxRedemptions !== undefined && input.maxRedemptions !== null && input.maxRedemptions < 1) return { ok: false, error: "maxRedemptions must be >= 1" };
  return { ok: true };
}

export async function createCoupon(input: { code?: string; description?: string; type: CouponType; value: number; duration?: CouponDuration; months?: number | null; maxRedemptions?: number | null; expiresAt?: Date | null; planId?: string | null }) {
  const v = validateCouponInput(input);
  if (!v.ok) throw new Error(v.error);
  const code = (input.code ?? genCode()).trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) throw new Error("code must be 3-24 chars A-Z 0-9 -");
  const dupe = await prisma.coupon.findUnique({ where: { code } });
  if (dupe) throw new Error("Coupon code already exists");
  return prisma.coupon.create({
    data: {
      code,
      description: input.description ?? null,
      type: input.type,
      value: input.value,
      duration: input.duration ?? "once",
      months: input.months ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt: input.expiresAt ?? null,
      planId: input.planId ?? null,
    },
  });
}

export async function listCoupons(opts?: { activeOnly?: boolean }) {
  const where: Record<string, unknown> = {};
  if (opts?.activeOnly) where.isActive = true;
  const [items, total] = await Promise.all([
    prisma.coupon.findMany({ where, include: { redemptions: { select: { amountDiscounted: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.coupon.count({ where }),
  ]);
  return {
    items: items.map((c) => ({ ...c, totalDiscounted: c.redemptions.reduce((s, r) => s + r.amountDiscounted, 0), redemptions: undefined })),
    total,
  };
}

export async function updateCouponStatus(id: string, isActive: boolean) {
  return prisma.coupon.update({ where: { id }, data: { isActive } });
}

/** Validate a coupon for use right now. Returns discount in cents for `amount`. */
export async function validateCoupon(code: string, opts?: { planId?: string | null; organizationId?: string }): Promise<{ ok: true; couponId: string; discount: number } | { ok: false; error: string }> {
  const c = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c || !c.isActive) return { ok: false, error: "Invalid or archived coupon" };
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return { ok: false, error: "Coupon expired" };
  // Plan-scoped coupons apply ONLY to that plan — an unknown target plan is
  // a rejection, never a silent all-plans bypass.
  if (c.planId) {
    if (!opts?.planId || c.planId !== opts.planId) return { ok: false, error: "Coupon not valid for this plan" };
  }
  if (c.maxRedemptions !== null && c.redeemedCount >= c.maxRedemptions) return { ok: false, error: "Coupon redemption limit reached" };
  if (opts?.organizationId) {
    const already = await prisma.couponRedemption.findUnique({ where: { couponId_organizationId: { couponId: c.id, organizationId: opts.organizationId } } });
    if (already) return { ok: false, error: "Coupon already redeemed by this organization" };
  }
  return { ok: true, couponId: c.id, discount: 0 }; // discount computed against concrete amount via computeDiscount
}

export function computeDiscount(type: string, value: number, amount: number): number {
  if (type === "percent") return Math.min(amount, Math.round((amount * value) / 10000));
  return Math.min(amount, value);
}

/**
 * Apply coupon to an invoice amount; records the redemption.
 *
 * mode "new" (default): first application — one redemption per org.
 * mode "renewal": re-application on a later invoice for the SAME org.
 *   - once → rejected (already redeemed)
 *   - repeating → allowed until `months` invoices have used it (exact count
 *     via CouponRedemption.timesApplied; the single redemption row is updated
 *     because @@unique([couponId, organizationId]) forbids per-invoice rows)
 *   - forever → always allowed while active/unexpired
 */
export async function applyCoupon(params: { code: string; organizationId: string; subscriptionId?: string | null; invoiceId?: string | null; amount: number; planId?: string | null; mode?: "new" | "renewal" }, tx?: Prisma.TransactionClient): Promise<{ amountDue: number; discount: number; couponId: string }> {
  const db = tx ?? prisma;
  const check = await validateCoupon(params.code, { planId: params.planId });
  if (!check.ok) throw new Error(check.error);
  const c = await db.coupon.findUniqueOrThrow({ where: { id: check.couponId } });

  const existing = await db.couponRedemption.findUnique({ where: { couponId_organizationId: { couponId: c.id, organizationId: params.organizationId } } });
  if (existing) {
    const monthsAllowed = c.duration === "repeating" ? c.months ?? 1 : null;
    const canRepeat =
      params.mode === "renewal" &&
      c.isActive &&
      (!c.expiresAt || c.expiresAt.getTime() > Date.now()) &&
      (c.duration === "forever" || (c.duration === "repeating" && existing.timesApplied < monthsAllowed!));
    if (!canRepeat) throw new Error("Coupon already redeemed by this organization");
    const discount = computeDiscount(c.type, c.value, params.amount);
    // Re-application mutates the org's single redemption row: cumulative
    // discount total + application count + latest invoice reference.
    // The conditional updateMany re-validates the application count AT WRITE
    // TIME, so two racing renewals cannot both consume the same month — the
    // loser observes a changed counter and aborts instead of over-applying.
    const claimedRepeat = await db.couponRedemption.updateMany({
      where: {
        id: existing.id,
        timesApplied: existing.timesApplied,
      },
      data: {
        amountDiscounted: existing.amountDiscounted + discount,
        timesApplied: { increment: 1 },
        invoiceId: params.invoiceId ?? existing.invoiceId,
        subscriptionId: params.subscriptionId ?? existing.subscriptionId,
      },
    });
    if (claimedRepeat.count === 0) {
      throw new Error("Coupon application raced with another invoice — not applied");
    }
    return { amountDue: params.amount - discount, discount, couponId: c.id };
  }

  // First application — claim against maxRedemptions atomically (the previous
  // check-then-increment let concurrent invoices exceed the cap).
  const discount = computeDiscount(c.type, c.value, params.amount);
  const claimed = await db.coupon.updateMany({
    where: {
      id: c.id,
      isActive: true,
      ...(c.maxRedemptions !== null ? { redeemedCount: { lt: c.maxRedemptions } } : {}),
    },
    data: { redeemedCount: { increment: 1 } },
  });
  if (claimed.count === 0) throw new Error("Coupon redemption limit reached");
  try {
    await db.couponRedemption.create({
      data: {
        couponId: c.id,
        organizationId: params.organizationId,
        subscriptionId: params.subscriptionId ?? null,
        invoiceId: params.invoiceId ?? null,
        amountDiscounted: discount,
      },
    });
  } catch (e) {
    await db.coupon.update({ where: { id: c.id }, data: { redeemedCount: { decrement: 1 } } }).catch(() => {});
    throw e;
  }
  return { amountDue: params.amount - discount, discount, couponId: c.id };
}
