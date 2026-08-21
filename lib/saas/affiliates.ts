/**
 * SaaS Affiliate Network — Phase G
 * Flow: Affiliate → Click → Lead → Trial → Org → Sub → Commission → Payout
 * Commission models: fixed, percent_first, percent_mrr_12, percent_mrr_recurring
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export type AffiliateStatus = "applied" | "review" | "approved" | "active" | "suspended";
export const AFFILIATE_STATUSES = ["applied","review","approved","active","suspended"] as const;

function genCode(prefix = "AFF"): string {
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function referralLink(code: string, baseUrl?: string): string {
  const base = baseUrl || process.env.SITE_URL || "https://thebuddharice.online";
  return `${base.replace(/\/$/,"")}/?ref=${code}`;
}

export async function createAffiliate(input: {
  name: string; businessName?: string; email: string; phone?: string; country?: string; website?: string;
  audience?: string; promotionMethod?: string; tier?: string; commissionModel?: string; commissionValue?: number;
  userId?: string;
}) {
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  if (!input.name?.trim()) throw new Error("Name required");
  const existing = await prisma.affiliate.findUnique({ where: { email } });
  if (existing) throw new Error("Affiliate with this email already exists");
  let code = genCode();
  for (let i=0; i<5; i++) {
    const c = await prisma.affiliate.findUnique({ where: { referralCode: code } });
    if (!c) break;
    code = genCode();
  }
  return prisma.affiliate.create({
    data: {
      name: input.name.trim(),
      businessName: input.businessName?.trim() || null,
      email,
      phone: input.phone || null,
      country: input.country?.toUpperCase() || null,
      website: input.website || null,
      audience: input.audience || null,
      promotionMethod: input.promotionMethod || null,
      tier: input.tier || "standard",
      commissionModel: input.commissionModel || "percent_mrr_12",
      commissionValue: input.commissionValue ?? 2000,
      referralCode: code,
      status: "applied",
      userId: input.userId || null,
    },
  });
}

export async function listAffiliates(opts?: { status?: string; q?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.q) where.OR = [{ name: { contains: opts.q } }, { email: { contains: opts.q } }, { referralCode: { contains: opts.q } }];
  const [items, total] = await Promise.all([
    prisma.affiliate.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.affiliate.count({ where }),
  ]);
  return { items, total };
}

export async function getAffiliate(id: string) {
  return prisma.affiliate.findUnique({
    where: { id },
    include: {
      clicks: { take: 10, orderBy: { createdAt: "desc" } },
      commissions: { take: 10, orderBy: { createdAt: "desc" } },
      payouts: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getAffiliateByCode(code: string) {
  return prisma.affiliate.findUnique({ where: { referralCode: code.toUpperCase() } });
}

export async function getAffiliateByEmail(email: string) {
  return prisma.affiliate.findUnique({ where: { email: email.toLowerCase() } });
}

export async function updateAffiliateStatus(id: string, status: AffiliateStatus) {
  if (!AFFILIATE_STATUSES.includes(status as never)) throw new Error("Invalid status");
  return prisma.affiliate.update({ where: { id }, data: { status } });
}

export async function trackClick(affiliateId: string, meta?: { ip?: string; userAgent?: string; referrer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }) {
  return prisma.affiliateClick.create({
    data: {
      affiliateId,
      ip: meta?.ip || null,
      userAgent: meta?.userAgent || null,
      referrer: meta?.referrer || null,
      utmSource: meta?.utmSource || null,
      utmMedium: meta?.utmMedium || null,
      utmCampaign: meta?.utmCampaign || null,
    },
  });
}

export async function attributeLeadToAffiliate(leadId: string, referralCode: string): Promise<string | null> {
  const aff = await getAffiliateByCode(referralCode);
  if (!aff) return null;
  if (aff.status !== "active" && aff.status !== "approved") return null;
  await prisma.affiliateCommission.create({
    data: {
      affiliateId: aff.id,
      leadId,
      amount: 0,
      currency: "USD",
      status: "pending",
      model: aff.commissionModel,
    },
  });
  return aff.id;
}
