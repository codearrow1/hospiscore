/**
 * Partner / Reseller Network — Phase O (P2 #21)
 * Partners actively sell/implement the PMS SaaS (vs affiliates who refer).
 * Shares the commission/payout ledger with affiliates (partnerId column on
 * AffiliateCommission/AffiliatePayout) and reuses transition/calc engines.
 */
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { calcCommissionAmount } from "./commissions";

export const PARTNER_STATUSES = ["applied", "review", "approved", "active", "suspended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_TYPES = ["it_agency", "consultant", "reseller", "implementation", "hmc"] as const;
export const PARTNER_TIERS = ["bronze", "silver", "gold", "platinum"] as const;

function genCode(): string {
  return `PRX${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createPartner(input: {
  name: string; company?: string; email: string; phone?: string; country?: string; website?: string;
  type?: string; tier?: string; commissionModel?: string; commissionValue?: number;
}) {
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  if (!input.name?.trim()) throw new Error("Name required");
  if (input.type && !PARTNER_TYPES.includes(input.type as never)) throw new Error("Invalid partner type");
  if (input.tier && !PARTNER_TIERS.includes(input.tier as never)) throw new Error("Invalid tier");
  const dupe = await prisma.partner.findUnique({ where: { email } });
  if (dupe) throw new Error("Partner with this email already exists");
  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const c = await prisma.partner.findUnique({ where: { referralCode: code } });
    if (!c) break;
    code = genCode();
  }
  return prisma.partner.create({
    data: {
      name: input.name.trim(),
      company: input.company?.trim() || null,
      email,
      phone: input.phone || null,
      country: input.country?.toUpperCase() || null,
      website: input.website || null,
      type: input.type || "reseller",
      tier: input.tier || "bronze",
      status: "applied",
      commissionModel: input.commissionModel || "percent_first",
      commissionValue: input.commissionValue ?? 1500,
      referralCode: code,
    },
  });
}

export async function listPartners(opts?: { status?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  const [items, total] = await Promise.all([
    prisma.partner.findMany({ where, include: { _count: { select: { organizations: true, commissions: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.partner.count({ where }),
  ]);
  return { items, total };
}

export async function getPartner(id: string) {
  return prisma.partner.findUnique({
    where: { id },
    include: {
      organizations: { select: { id: true, legalName: true, mrr: true, country: true } },
      commissions: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getPartnerByCode(code: string) {
  return prisma.partner.findUnique({ where: { referralCode: code.toUpperCase() } });
}

export async function updatePartnerStatus(id: string, status: PartnerStatus) {
  if (!PARTNER_STATUSES.includes(status as never)) throw new Error("Invalid status");
  return prisma.partner.update({ where: { id }, data: { status } });
}

/** Commission when a partner-sourced organization's subscription activates. */
export async function createCommissionForPartnerSubscription(params: { partnerId: string; organizationId: string; subscriptionId: string; mrr: number }) {
  const partner = await prisma.partner.findUnique({ where: { id: params.partnerId } });
  if (!partner) throw new Error("Partner not found");
  if (partner.status !== "active" && partner.status !== "approved") throw new Error("Partner not active");
  const amount = calcCommissionAmount(partner.commissionModel, partner.commissionValue, params.mrr);
  return prisma.affiliateCommission.create({
    data: {
      partnerId: params.partnerId,
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      amount,
      currency: "USD",
      status: "pending",
      model: partner.commissionModel,
    },
  });
}

export async function listPartnerCommissions(opts?: { partnerId?: string; status?: string }) {
  const where: Record<string, unknown> = { partnerId: { not: null } };
  if (opts?.partnerId) where.partnerId = opts.partnerId;
  if (opts?.status) where.status = opts.status;
  const items = await prisma.affiliateCommission.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return { items, total: items.length };
}

export async function listPartnerPayouts(opts?: { partnerId?: string; status?: string }) {
  const where: Record<string, unknown> = { partnerId: { not: null } };
  if (opts?.partnerId) where.partnerId = opts.partnerId;
  if (opts?.status) where.status = opts.status;
  const items = await prisma.affiliatePayout.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return { items, total: items.length };
}

/** Consolidate approved commissions into a payout request. */
export async function requestPartnerPayout(params: { partnerId: string; amount: number; method?: string }) {
  if (!(params.amount > 0)) throw new Error("amount must be positive");
  const partner = await prisma.partner.findUnique({ where: { id: params.partnerId } });
  if (!partner) throw new Error("Partner not found");
  return prisma.affiliatePayout.create({
    data: { partnerId: params.partnerId, amount: Math.round(params.amount), method: params.method || "bank", status: "requested" },
  });
}
