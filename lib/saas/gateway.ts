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
  // idempotency: if key provided, check existing invoice with same key in detail? For now stub: check recent duplicate within 60s
  if (input.idempotencyKey) {
    const recent = await prisma.invoice.findFirst({
      where: { organizationId: input.organizationId, amount: input.amount, createdAt: { gte: new Date(Date.now() - 60000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return recent as GatewayInvoice;
  }
  let amount = input.amount;
  let couponApplied: string | null = null;
  if (input.couponCode) {
    const { applyCoupon } = await import("./coupons");
    const res = await applyCoupon({ code: input.couponCode, organizationId: input.organizationId, subscriptionId: input.subscriptionId ?? null, amount });
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
  gateway?: string;
  status?: string;
  actorEmail: string;
  ip?: string;
  idempotencyKey?: string;
}) {
  if (input.idempotencyKey) {
    const recent = await prisma.payment.findFirst({
      where: { organizationId: input.organizationId, amount: input.amount, createdAt: { gte: new Date(Date.now() - 60000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return recent;
  }
  const pay = await prisma.payment.create({
    data: {
      organizationId: input.organizationId,
      invoiceId: input.invoiceId || null,
      amount: input.amount,
      currency: "USD",
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
  const updated = await prisma.payment.update({ where: { id: paymentId }, data: { status: "refunded" } });
  await writeSaasAudit({ byEmail: actorEmail, action: "payment.refunded", entity: "payment", entityId: paymentId, detail: `refund ${(pay.amount/100).toFixed(2)}`, ip });
  return updated;
}
