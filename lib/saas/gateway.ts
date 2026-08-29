/**
 * SaaS Payment Gateway Abstraction — Phase D
 * Never couple business logic directly to Stripe/Razorpay.
 * Provides idempotent invoice/payment ops with immutable audit.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { writeSaasAudit } from "./audit";
import { applyCoupon } from "./coupons";

export interface GatewayInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Transaction client so financial sections can run atomically. */
export type GatewayTx = Prisma.TransactionClient;

export async function createInvoice(
  input: {
    organizationId: string;
    subscriptionId?: string;
    amount: number;
    currency?: string;
    type?: string;
    dueAt?: Date;
    idempotencyKey?: string;
    couponCode?: string;
    /** "renewal" lets repeating/forever coupons re-apply on later invoices. */
    couponMode?: "new" | "renewal";
    actorEmail: string;
    ip?: string;
  },
  tx?: GatewayTx,
): Promise<GatewayInvoice> {
  if (input.amount < 0) throw new Error("amount must be >= 0");
  const db = tx ?? prisma;

  // Caller idempotency: a supplied key means "this exact logical operation (as
  // identified by the caller) has already been initiated". If it already
  // produced an invoice, return that invoice instead of creating a duplicate —
  // safe for duplicate request, network retry, timeout, or a concurrent
  // re-submission with the same key. Different keys always create new invoices.
  if (input.idempotencyKey) {
    const existing = await db.invoice.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing as GatewayInvoice;
  }

  let amount = input.amount;
  let couponApplied: string | null = null;
  if (input.couponCode) {
    // Resolve the subscription's plan so plan-scoped coupons are honored
    // (and enforced) against the right plan.
    let couponPlanId: string | undefined;
    if (input.subscriptionId) {
      const sub = await db.subscription.findUnique({ where: { id: input.subscriptionId }, select: { planId: true } });
      couponPlanId = sub?.planId;
    }
    const res = await applyCoupon({ code: input.couponCode, organizationId: input.organizationId, subscriptionId: input.subscriptionId ?? null, amount, planId: couponPlanId, mode: input.couponMode }, tx);
    amount = res.amountDue;
    couponApplied = res.couponId;
  }
  let inv;
  try {
    inv = await db.invoice.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId || null,
        amount,
        currency: input.currency || "USD",
        type: input.type || "subscription",
        status: "issued",
        dueAt: input.dueAt || null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  } catch (e) {
    // A concurrent caller with the SAME idempotency key won the unique-index
    // race. Fold into the existing invoice rather than failing the retry.
    if (input.idempotencyKey && (e as { code?: string })?.code === "P2002") {
      const existing = await db.invoice.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing as GatewayInvoice;
    }
    throw e;
  }
  await writeSaasAudit({
    byEmail: input.actorEmail,
    action: "invoice.created",
    entity: "invoice",
    entityId: inv.id,
    detail: `${inv.type} ${(inv.amount/100).toFixed(2)}${couponApplied ? ` (coupon ${input.couponCode})` : ""}`,
    ip: input.ip,
  });
  return inv as GatewayInvoice;
}

export async function recordPayment(input: {
  organizationId: string;
  invoiceId?: string;
  amount: number;
  currency?: string;
  gateway?: string;
  status?: string;
  actorEmail: string;
  ip?: string;
  idempotencyKey?: string;
}) {
  // Caller idempotency pre-check: if this exact logical operation (caller key)
  // already produced a payment, return that payment and do NOT re-settle,
  // re-dun, or re-commission anything — those side-effects already ran once.
  if (input.idempotencyKey) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  let currency = input.currency || "USD";
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new Error("amount must be a non-negative integer (minor units)");
  }
  let fullySettled = false;
  let pay: Awaited<ReturnType<typeof prisma.payment.create>> | undefined;
  try {
    pay = await prisma.$transaction(async (tx) => {
    if (input.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: input.invoiceId }, select: { amount: true, currency: true, status: true } });
      if (!inv) throw new Error("Invoice not found");
      if (input.currency && inv.currency && input.currency !== inv.currency) {
        throw new Error(`Payment currency ${input.currency} does not match invoice currency ${inv.currency}`);
      }
      if (inv.currency) currency = inv.currency;
      if (inv.status === "void") throw new Error("Cannot pay a voided invoice");
      // Overpayment cap (M-02), evaluated INSIDE the transaction so two
      // concurrent payments cannot both observe the same outstanding
      // balance and collectively overpay the invoice.
      const paidAgg = await tx.payment.aggregate({ where: { invoiceId: input.invoiceId, status: "succeeded" }, _sum: { amount: true } });
      const outstanding = inv.amount - (paidAgg._sum.amount ?? 0);
      if (input.amount > outstanding) {
        throw new Error(`Payment exceeds outstanding balance (${outstanding} ${currency})`);
      }
    }
    const created = await tx.payment.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId || null,
        amount: input.amount,
        currency,
        gateway: input.gateway || "manual",
        status: input.status || "succeeded",
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    if (input.invoiceId && (input.status || "succeeded") === "succeeded") {
      // Settle inside the same transaction as the payment insert — invoice
      // status can never disagree with its succeeded payment total. Our
      // INSERT took the DB write lock, so this aggregate observes every
      // committed contender: the authoritative post-race balance.
      const paidAgg = await tx.payment.aggregate({ where: { invoiceId: input.invoiceId, status: "succeeded" }, _sum: { amount: true } });
      const inv = await tx.invoice.findUnique({ where: { id: input.invoiceId }, select: { amount: true, status: true } });
      if (!inv) throw new Error("Invoice not found");
      if (inv.status === "void") throw new Error("Cannot pay a voided invoice");
      const totalPaid = paidAgg._sum.amount ?? 0;
      if (totalPaid > inv.amount) {
        // A concurrent payment committed after our (stale) pre-check —
        // refuse ours so persisted money can never exceed the invoice.
        throw new Error(`Payment raced past the invoice balance (${totalPaid}/${inv.amount})`);
      }
      const newStatus = totalPaid >= inv.amount ? "paid" : totalPaid > 0 ? "partially_paid" : inv.status;
      fullySettled = newStatus === "paid";
      await tx.invoice.update({ where: { id: input.invoiceId! }, data: { status: newStatus, paidAt: newStatus === "paid" ? new Date() : null } });
    }
    return created;
  }, { maxWait: 20_000, timeout: 60_000 });
  } catch (e) {
    // A concurrent caller with the SAME idempotency key won the unique-index
    // race. Fold into the already-recorded payment (its settlement and
    // side-effects already ran once) rather than fail the retry.
    if (input.idempotencyKey && (e as { code?: string })?.code === "P2002") {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
    }
    throw e;
  }
  if (!pay) throw new Error("Payment not recorded");
  await writeSaasAudit({ byEmail: input.actorEmail, action: "payment.recorded", entity: "payment", entityId: pay.id, detail: `${pay.gateway} ${(pay.amount/100).toFixed(2)} ${pay.status}`, ip: input.ip });

  // Dunning hooks (side-effecting emails stay outside the DB transaction).
  const { startDunning, recoverCase } = await import("./dunning");
  if (pay.status === "failed" && input.invoiceId) {
    let subscriptionId: string | null = null;
    if (input.invoiceId) {
      const inv = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, select: { subscriptionId: true } });
      subscriptionId = inv?.subscriptionId ?? null;
      // mark invoice past_due and downgrade subscription to past_due
      await prisma.invoice.update({ where: { id: input.invoiceId }, data: { status: "past_due" } });
      if (subscriptionId) {
        await prisma.subscription.updateMany({ where: { id: subscriptionId, status: "active" }, data: { status: "past_due" } });
        try {
          const { syncOrgMrr } = await import("./subscriptions");
          if (input.organizationId) await syncOrgMrr(input.organizationId);
        } catch (e) { console.error("[gateway] syncOrgMrr failed after payment failure:", e); }
      }
    }
    await startDunning({ invoiceId: input.invoiceId, organizationId: input.organizationId, subscriptionId, reason: `payment ${pay.id} failed` });
    try {
      const { fireRule } = await import("./automation");
      await fireRule("payment_failed", input.organizationId, { amount: (pay.amount / 100).toFixed(2) });
    } catch (e) { console.error("[gateway] fireRule payment_failed failed:", e); }
  } else if (pay.status === "succeeded" && input.invoiceId) {
    // Settlement math already ran inside the payment transaction; `fullySettled`
    // was computed there. Dunning recovery (M-01) fires only on FULL
    // settlement — a partial payment must neither close the collection case
    // nor reactivate service.
    if (fullySettled) {
      await recoverCase(input.invoiceId);
      // Recurring commission: if this is a renewal (not the first payment for this subscription),
      // generate a recurring commission for the affiliate.
      try {
        if (input.invoiceId) {
          const inv = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, select: { subscriptionId: true } });
          if (inv?.subscriptionId) {
            const existingDirect = await prisma.affiliateCommission.findFirst({
              where: { subscriptionId: inv.subscriptionId, commissionType: { notIn: ["recurring"] }, status: { notIn: ["reversed", "rejected"] } },
              select: { id: true },
            });
            if (existingDirect) {
              // This is a renewal — find the subscription for MRR
              const sub = await prisma.subscription.findUnique({ where: { id: inv.subscriptionId }, select: { mrr: true, organizationId: true } });
              if (sub) {
                const { createRecurringCommission } = await import("./recurringCommissions");
                await createRecurringCommission({
                  organizationId: sub.organizationId,
                  subscriptionId: inv.subscriptionId,
                  paymentId: pay.id,
                  mrr: sub.mrr,
                  invoiceId: input.invoiceId,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("[gateway] recurring commission failed:", e);
      }
    }
  }
  return pay;
}

/**
 * Void an unsettled invoice (M-03). Paid invoices go through refunds instead;
 * open dunning cases are closed because nothing is collectable anymore.
 * The status flip is a conditional claim, so a concurrent double-void or a
 * void racing a settlement cannot both win.
 */
export async function voidInvoice(invoiceId: string, actorEmail: string, ip?: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } });
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "void") throw new Error("Invoice is already void");
  if (inv.status === "paid") throw new Error("Paid invoices must be refunded, not voided");
  if (!["issued", "past_due", "partially_paid"].includes(inv.status)) {
    throw new Error(`Cannot void a ${inv.status} invoice`);
  }
  const claimed = await prisma.invoice.updateMany({
    where: { id: invoiceId, status: { in: ["issued", "past_due", "partially_paid"] } },
    data: { status: "void" },
  });
  if (claimed.count === 0) throw new Error("Invoice state changed — retry");
  // Nothing left to collect — stop the retry ladder.
  await prisma.dunningCase.updateMany({ where: { invoiceId, status: "active" }, data: { status: "given_up", nextRetryAt: null } });
  await writeSaasAudit({ byEmail: actorEmail, action: "invoice.voided", entity: "invoice", entityId: invoiceId, detail: `was ${inv.status}`, ip });
  return prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
}

export async function refundPayment(paymentId: string, actorEmail: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!pay) throw new Error("Payment not found");
    if (pay.status === "refunded") throw new Error("Already refunded");
    if (pay.status !== "succeeded") throw new Error(`Only succeeded payments are refundable (payment is ${pay.status})`);
    await tx.payment.update({ where: { id: paymentId }, data: { status: "refunded" } });

    if (pay.invoiceId) {
      const paidAgg = await tx.payment.aggregate({ where: { invoiceId: pay.invoiceId, status: "succeeded" }, _sum: { amount: true } });
      const inv = await tx.invoice.findUnique({ where: { id: pay.invoiceId }, select: { amount: true, status: true, subscriptionId: true } });
      if (inv && inv.status !== "void") {
        const totalPaid = paidAgg._sum.amount ?? 0;
        const newStatus = totalPaid >= inv.amount ? "paid" : totalPaid > 0 ? "partially_paid" : "issued";
        if (newStatus !== inv.status || (newStatus === "issued")) {
          await tx.invoice.update({
            where: { id: pay.invoiceId },
            data: { status: newStatus, ...(newStatus !== "paid" ? { paidAt: null } : {}) },
          });
        }
      }
    }
    // NOTE: do NOT call writeSaasAudit here — it uses the global Prisma client
    // while this transaction holds the SQLite write lock, which deadlocks
    // (P1008). The audit is written after commit below.
    return { amount: pay.amount, invoiceId: pay.invoiceId, organizationId: pay.organizationId };
  }, { maxWait: 20_000, timeout: 60_000 }).then(async (result) => {
    await writeSaasAudit({ byEmail: actorEmail, action: "payment.refunded", entity: "payment", entityId: paymentId, detail: `refund ${(result.amount/100).toFixed(2)}`, ip });
    if (result.invoiceId) {
      try {
        const inv = await prisma.invoice.findUnique({ where: { id: result.invoiceId }, select: { subscriptionId: true } });
        if (inv?.subscriptionId) {
          const { handleReversal } = await import("./commissions");
          await handleReversal(result.organizationId, inv.subscriptionId);
        }
      } catch (e) { console.error("[gateway] commission reversal failed:", e); }
    }
    return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  });
}
