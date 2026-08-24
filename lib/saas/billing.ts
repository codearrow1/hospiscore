import { prisma } from "@/lib/prisma";

export async function listInvoices(opts?: { orgId?: string; status?: string; type?: string; q?: string; take?: number; skip?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.orgId) where.organizationId = opts.orgId;
  if (opts?.status) where.status = opts.status;
  if (opts?.type) where.type = opts.type;
  if (opts?.q) {
    // Search by organization name or exact invoice id prefix
    const q = String(opts.q).trim();
    where.OR = [
      { organization: { legalName: { contains: q } } },
      { id: { startsWith: q } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: { organization: { select: { legalName: true, country: true } }, subscription: { include: { plan: true } }, payments: true }, orderBy: { createdAt: "desc" }, take: opts?.take ?? 50, skip: opts?.skip ?? 0 }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total };
}

/** Per-currency AR aggregates over an arbitrary invoice filter — totals strip. */
export async function invoiceTotals(where: Record<string, unknown> = {}) {
  const rows = await prisma.invoice.groupBy({
    by: ["currency", "status"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });
  return rows;
}

// NOTE: invoice creation intentionally lives ONLY in lib/saas/gateway.ts
// (createInvoice) — it enforces coupon rules, audit logging and the tx-aware
// write path. A bare prisma.invoice.create here would silently bypass all of
// that, so the previous duplicate was removed.

export async function listPayments(opts?: { orgId?: string; status?: string; q?: string; take?: number; skip?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.orgId) where.organizationId = opts.orgId;
  if (opts?.status) where.status = opts.status;
  if (opts?.q) {
    const q = String(opts.q).trim();
    where.OR = [
      { organization: { legalName: { contains: q } } },
      { id: { startsWith: q } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, include: { organization: { select: { legalName: true, country: true } }, invoice: true }, orderBy: { createdAt: "desc" }, take: opts?.take ?? 50, skip: opts?.skip ?? 0 }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}
