import { prisma } from "@/lib/prisma";

export async function listInvoices(opts?: { orgId?: string; status?: string; take?: number; skip?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.orgId) where.organizationId = opts.orgId;
  if (opts?.status) where.status = opts.status;
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: { organization: { select: { legalName: true } }, subscription: { include: { plan: true } }, payments: true }, orderBy: { createdAt: "desc" }, take: opts?.take ?? 50, skip: opts?.skip ?? 0 }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total };
}

export async function createInvoice(input: { organizationId: string; subscriptionId?: string; amount: number; currency?: string; type?: string; dueAt?: Date }) {
  return prisma.invoice.create({
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
}

export async function listPayments(opts?: { orgId?: string; status?: string; take?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.orgId) where.organizationId = opts.orgId;
  if (opts?.status) where.status = opts.status;
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, include: { organization: { select: { legalName: true } }, invoice: true }, orderBy: { createdAt: "desc" }, take: opts?.take ?? 50 }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}
