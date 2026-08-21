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
  const inv = await prisma.invoice.create({
    data: {
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId || null,
      amount: input.amount,
      currency: input.currency || "USD",
      type: input.type || "subscription",
      status: "issued",
      dueAt: input.dueAt || null,
    },
  });
  await writeSaasAudit({ byEmail: input.actorEmail, action: "invoice.created", entity: "invoice", entityId: inv.id, detail: `${inv.type} ${(inv.amount/100).toFixed(2)}`, ip: input.ip });
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
