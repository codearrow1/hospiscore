/**
 * Partner / Reseller Network — Phase O (P2 #21)
 * Partners actively sell/implement the PMS SaaS (vs affiliates who refer).
 * Shares the commission/payout ledger with affiliates (partnerId column on
 * AffiliateCommission/AffiliatePayout) and reuses transition/calc engines.
 */
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { calcCommissionAmount } from "./commissions";
import { availablePayoutBalance } from "./payouts";
import { resolveSetting } from "@/lib/settings/resolver";

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
  const defaultValue = await resolveSetting<number>("partner_default_commission_value");
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
      commissionValue: input.commissionValue ?? defaultValue,
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

/** Enforced lifecycle: applied → review → approved → active; active ⇄ suspended. */
const ALLOWED_PARTNER_STATUS: Record<PartnerStatus, PartnerStatus[]> = {
  applied: ["review"],
  review: ["approved"],
  approved: ["active"],
  active: ["suspended"],
  suspended: ["active"],
};

export function canTransitionPartner(from: PartnerStatus, to: PartnerStatus): boolean {
  if (from === to) return false;
  return ALLOWED_PARTNER_STATUS[from]?.includes(to) ?? false;
}

export async function updatePartnerStatus(id: string, status: PartnerStatus) {
  if (!PARTNER_STATUSES.includes(status as never)) throw new Error("Invalid status");
  const cur = await prisma.partner.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw new Error("Partner not found");
  if (!canTransitionPartner(cur.status as PartnerStatus, status)) throw new Error(`Cannot transition ${cur.status} → ${status}`);
  return prisma.partner.update({ where: { id }, data: { status } });
}

/** Commission when a partner-sourced organization's subscription activates. Idempotent per (partner, org). */
export async function createCommissionForPartnerSubscription(params: { partnerId: string; organizationId: string; subscriptionId: string; mrr: number }) {
  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: params.partnerId } });
    if (!partner) throw new Error("Partner not found");
    if (partner.status !== "active" && partner.status !== "approved") throw new Error("Partner not active");
    const dupe = await tx.affiliateCommission.findFirst({
      where: { partnerId: params.partnerId, organizationId: params.organizationId, status: { notIn: ["reversed", "rejected"] } },
      select: { id: true },
    });
    if (dupe) return tx.affiliateCommission.findUnique({ where: { id: dupe.id } });
    const amount = calcCommissionAmount(partner.commissionModel, partner.commissionValue, params.mrr);
    return tx.affiliateCommission.create({
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
  const amount = Math.round(Number(params.amount));
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("amount must be positive");
  const partner = await prisma.partner.findUnique({ where: { id: params.partnerId } });
  if (!partner) throw new Error("Partner not found");
  // Balance check and creation share one transaction so concurrent requests
  // cannot both pass the check against the same payable sum.
  return prisma.$transaction(async (tx) => {
    const balance = await availablePayoutBalance({ partnerId: params.partnerId }, tx);
    if (amount > balance) {
      throw new Error(`Amount exceeds available payable balance (${balance})`);
    }
    return tx.affiliatePayout.create({
      data: { partnerId: params.partnerId, amount, method: params.method || "bank", status: "requested" },
    });
  });
}
