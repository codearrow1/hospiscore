/**
 * SaaS Payment Gateway Abstraction — Phase D
 * Never couple business logic directly to Stripe/Razorpay.
 * Provides idempotent invoice/payment ops with immutable audit.
 */

import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "./audit";

export interface GatewayInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createInvoice(input: {
  organizationId: string;
  subscriptionId?: string;
  amount: number;
  currency?: string;
  type?: string;
  dueAt?: Date;
  idempotencyKey?: string;
  couponCode?: string;
  actorEmail: string;
  ip?: string;
}): Promise<GatewayInvoice> {
  if (input.amount < 0) throw new Error("amount must be >= 0");
  // NOTE: idempotencyKey is accepted for API compatibility but not yet enforced
  // (no stored key column). Two legitimate identical invoices may coexist.
  let amount = input.amount;
  let couponApplied: string | null = null;
  if (input.couponCode) {
    // Resolve the subscription's plan so plan-scoped coupons are honored
    // (and enforced) against the right plan.
    let couponPlanId: string | undefined;
    if (input.subscriptionId) {
      const sub = await prisma.subscription.findUnique({ where: { id: input.subscriptionId }, select: { planId: true } });
      couponPlanId = sub?.planId;
    }
    const { applyCoupon } = await import("./coupons");
    const res = await applyCoupon({ code: input.couponCode, organizationId: input.organizationId, subscriptionId: input.subscriptionId ?? null, amount, planId: couponPlanId });
    amount = res.amountDue;
    couponApplied = res.couponId;
  }
  const inv = await prisma.invoice.create({
    data: {
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId || null,
      amount,
      currency: input.currency || "USD",
      type: input.type || "subscription",
      status: "issued",
      dueAt: input.dueAt || null,
    },
  });
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
  // NOTE: idempotencyKey accepted but not enforced (no stored key column) —
  // the previous 60s lookalike window silently swallowed real payments.
  // Currency always matches the invoice's own currency — never settle an
  // INR invoice against a USD payment total.
  let currency = input.currency || "USD";
  if (input.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, select: { amount: true, currency: true, status: true, subscriptionId: true } });
    if (!inv) throw new Error("Invoice not found");
    if (input.currency && inv.currency && input.currency !== inv.currency) {
      throw new Error(`Payment currency ${input.currency} does not match invoice currency ${inv.currency}`);
    }
    if (inv.currency) currency = inv.currency;
  }
  const pay = await prisma.payment.create({
    data: {
      organizationId: input.organizationId,
      invoiceId: input.invoiceId || null,
      amount: input.amount,
      currency,
      gateway: input.gateway || "manual",
      status: input.status || "succeeded",
    },
  });
  await writeSaasAudit({ byEmail: input.actorEmail, action: "payment.recorded", entity: "payment", entityId: pay.id, detail: `${pay.gateway} ${(pay.amount/100).toFixed(2)} ${pay.status}`, ip: input.ip });

  // Dunning hooks
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
        } catch {}
      }
    }
    await startDunning({ invoiceId: input.invoiceId, organizationId: input.organizationId, subscriptionId, reason: `payment ${pay.id} failed` });
    try {
      const { fireRule } = await import("./automation");
      await fireRule("payment_failed", input.organizationId, { amount: (pay.amount / 100).toFixed(2) });
    } catch {}
  } else if (pay.status === "succeeded" && input.invoiceId) {
    await recoverCase(input.invoiceId);
    // mark invoice paid when fully settled
    const paidAgg = await prisma.payment.aggregate({ where: { invoiceId: input.invoiceId, status: "succeeded" }, _sum: { amount: true } });
    const inv = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, select: { amount: true, status: true } });
    if (inv && inv.status !== "void") {
      const totalPaid = paidAgg._sum.amount ?? 0;
      const newStatus = totalPaid >= inv.amount ? "paid" : totalPaid > 0 ? "partially_paid" : inv.status;
      await prisma.invoice.update({ where: { id: input.invoiceId }, data: { status: newStatus, paidAt: newStatus === "paid" ? new Date() : null } });
    }
  }
  return pay;
}

export async function refundPayment(paymentId: string, actorEmail: string, ip?: string) {
  const pay = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!pay) throw new Error("Payment not found");
  if (pay.status === "refunded") throw new Error("Already refunded");
  if (pay.status !== "succeeded") throw new Error(`Only succeeded payments are refundable (payment is ${pay.status})`);
  const updated = await prisma.payment.update({ where: { id: paymentId }, data: { status: "refunded" } });
  await writeSaasAudit({ byEmail: actorEmail, action: "payment.refunded", entity: "payment", entityId: paymentId, detail: `refund ${(pay.amount/100).toFixed(2)}`, ip });

  if (pay.invoiceId) {
    // Re-settle the invoice excluding refunded money.
    const paidAgg = await prisma.payment.aggregate({ where: { invoiceId: pay.invoiceId, status: "succeeded" }, _sum: { amount: true } });
    const inv = await prisma.invoice.findUnique({ where: { id: pay.invoiceId }, select: { amount: true, status: true, subscriptionId: true } });
    if (inv && inv.status !== "void") {
      const totalPaid = paidAgg._sum.amount ?? 0;
      const newStatus = totalPaid >= inv.amount ? "paid" : totalPaid > 0 ? "partially_paid" : "issued";
      if (newStatus !== inv.status || (newStatus === "issued")) {
        await prisma.invoice.update({
          where: { id: pay.invoiceId },
          data: { status: newStatus, ...(newStatus !== "paid" ? { paidAt: null } : {}) },
        });
      }
    }
    // Policy: refunds reverse outstanding commissions for the subscription.
    try {
      if (inv?.subscriptionId) {
        const { handleReversal } = await import("./commissions");
        await handleReversal(pay.organizationId, inv.subscriptionId);
      }
    } catch {}
  }
  return updated;
}
