/**
 * Affiliate Campaign Service — Phase D
 * CRUD + rule resolution for campaign-level commission rules.
 * Plan-specific and country-specific overrides.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

export type CampaignStatus = "draft" | "active" | "paused" | "ended" | "archived";
export const CAMPAIGN_STATUSES = ["draft","active","paused","ended","archived"] as const;

export type CommissionModel = "fixed" | "percent_first" | "percent_mrr_12" | "percent_mrr_recurring";
export const COMMISSION_MODELS = ["fixed","percent_first","percent_mrr_12","percent_mrr_recurring"] as const;

export type AttributionModel = "first_touch" | "last_touch";
export const ATTRIBUTION_MODELS = ["first_touch","last_touch"] as const;

const ALLOWED: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active","archived"],
  active: ["paused","ended","archived"],
  paused: ["active","ended","archived"],
  ended: ["archived"],
  archived: [],
};

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export async function createCampaign(input: {
  name: string;
  slug?: string;
  description?: string;
  commissionModel?: CommissionModel;
  commissionValue?: number;
  recurringDuration?: number;
  recurringLimit?: number;
  cookieDays?: number;
  attributionModel?: AttributionModel;
  holdingPeriodDays?: number;
  maxCommission?: number;
  minPayout?: number;
  tier2OverrideRate?: number;
  tier3OverrideRate?: number;
  overrideFundingModel?: string;
  maxTierDepth?: number;
  planOverrides?: Record<string, unknown>;
  countryOverrides?: Record<string, unknown>;
  fraudRules?: Record<string, unknown>;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Campaign name required");

  // Generate slug from name if not provided
  let slug = input.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Ensure slug uniqueness
  const existing = await prisma.affiliateCampaign.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  return prisma.affiliateCampaign.create({
    data: {
      name,
      slug,
      description: input.description?.trim() || null,
      commissionModel: input.commissionModel || "percent_mrr_12",
      commissionValue: input.commissionValue ?? 2000,
      recurringDuration: input.recurringDuration ?? 12,
      recurringLimit: input.recurringLimit ?? null,
      cookieDays: input.cookieDays ?? 90,
      attributionModel: input.attributionModel || "first_touch",
      holdingPeriodDays: input.holdingPeriodDays ?? 30,
      maxCommission: input.maxCommission ?? null,
      minPayout: input.minPayout ?? 5000,
      tier2OverrideRate: input.tier2OverrideRate ?? 0,
      tier3OverrideRate: input.tier3OverrideRate ?? 0,
      overrideFundingModel: input.overrideFundingModel || "company_funded",
      maxTierDepth: input.maxTierDepth ?? 3,
      planOverrides: input.planOverrides ? (input.planOverrides as Prisma.InputJsonValue) : Prisma.JsonNull,
      countryOverrides: input.countryOverrides ? (input.countryOverrides as Prisma.InputJsonValue) : Prisma.JsonNull,
      fraudRules: input.fraudRules ? (input.fraudRules as Prisma.InputJsonValue) : Prisma.JsonNull,
      status: "draft",
    },
  });
}

export async function updateCampaign(id: string, input: Partial<{
  name: string;
  description: string;
  commissionModel: CommissionModel;
  commissionValue: number;
  recurringDuration: number;
  recurringLimit: number | null;
  cookieDays: number;
  attributionModel: AttributionModel;
  holdingPeriodDays: number;
  maxCommission: number | null;
  minPayout: number;
  tier2OverrideRate: number;
  tier3OverrideRate: number;
  overrideFundingModel: string;
  maxTierDepth: number;
  planOverrides: Record<string, unknown>;
  countryOverrides: Record<string, unknown>;
  fraudRules: Record<string, unknown>;
}>) {
  const existing = await prisma.affiliateCampaign.findUnique({ where: { id } });
  if (!existing) throw new Error("Campaign not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.commissionModel !== undefined) data.commissionModel = input.commissionModel;
  if (input.commissionValue !== undefined) data.commissionValue = input.commissionValue;
  if (input.recurringDuration !== undefined) data.recurringDuration = input.recurringDuration;
  if (input.recurringLimit !== undefined) data.recurringLimit = input.recurringLimit;
  if (input.cookieDays !== undefined) data.cookieDays = input.cookieDays;
  if (input.attributionModel !== undefined) data.attributionModel = input.attributionModel;
  if (input.holdingPeriodDays !== undefined) data.holdingPeriodDays = input.holdingPeriodDays;
  if (input.maxCommission !== undefined) data.maxCommission = input.maxCommission;
  if (input.minPayout !== undefined) data.minPayout = input.minPayout;
  if (input.tier2OverrideRate !== undefined) data.tier2OverrideRate = input.tier2OverrideRate;
  if (input.tier3OverrideRate !== undefined) data.tier3OverrideRate = input.tier3OverrideRate;
  if (input.overrideFundingModel !== undefined) data.overrideFundingModel = input.overrideFundingModel;
  if (input.maxTierDepth !== undefined) data.maxTierDepth = Math.min(Math.max(input.maxTierDepth, 0), 5);
  if (input.planOverrides !== undefined) data.planOverrides = input.planOverrides ? (input.planOverrides as Prisma.InputJsonValue) : Prisma.JsonNull;
  if (input.countryOverrides !== undefined) data.countryOverrides = input.countryOverrides ? (input.countryOverrides as Prisma.InputJsonValue) : Prisma.JsonNull;
  if (input.fraudRules !== undefined) data.fraudRules = input.fraudRules ? (input.fraudRules as Prisma.InputJsonValue) : Prisma.JsonNull;

  return prisma.affiliateCampaign.update({ where: { id }, data });
}

export async function updateCampaignStatus(id: string, to: CampaignStatus) {
  if (!CAMPAIGN_STATUSES.includes(to as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliateCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw new Error("Campaign not found");
  if (!canTransitionCampaign(cur.status as CampaignStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);
  return prisma.affiliateCampaign.update({ where: { id }, data: { status: to } });
}

export async function getCampaign(id: string) {
  return prisma.affiliateCampaign.findUnique({
    where: { id },
    include: {
      _count: { select: { affiliates: true, clicks: true, commissions: true, members: true } },
      performanceTiers: { orderBy: { displayOrder: "asc" } },
    },
  });
}

export async function listCampaigns(opts?: { status?: string; q?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.q) where.OR = [{ name: { contains: opts.q } }, { slug: { contains: opts.q } }];

  const [items, total] = await Promise.all([
    prisma.affiliateCampaign.findMany({
      where,
      include: { _count: { select: { affiliates: true, commissions: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.affiliateCampaign.count({ where }),
  ]);
  return { items, total };
}

/**
 * Resolve effective commission parameters for an affiliate + optional plan/country.
 * Priority: affiliate custom > plan override > country override > campaign default.
 */
export async function resolveCommissionRules(params: {
  campaignId?: string | null;
  affiliateId?: string;
  planSlug?: string;
  country?: string;
}) {
  if (!params.campaignId) return null;

  const campaign = await prisma.affiliateCampaign.findUnique({
    where: { id: params.campaignId },
  });
  if (!campaign || campaign.status !== "active") return null;

  let model = campaign.commissionModel;
  let value = campaign.commissionValue;

  // Country override
  if (campaign.countryOverrides && params.country) {
    const overrides = campaign.countryOverrides as Record<string, { model?: string; value?: number }>;
    const countryOverride = overrides[params.country.toUpperCase()];
    if (countryOverride) {
      if (countryOverride.model) model = countryOverride.model;
      if (countryOverride.value !== undefined) value = countryOverride.value;
    }
  }

  // Plan override (takes precedence over country)
  if (campaign.planOverrides && params.planSlug) {
    const overrides = campaign.planOverrides as Record<string, { model?: string; value?: number }>;
    const planOverride = overrides[params.planSlug];
    if (planOverride) {
      if (planOverride.model) model = planOverride.model;
      if (planOverride.value !== undefined) value = planOverride.value;
    }
  }

  // Affiliate-level custom override (highest precedence)
  if (params.affiliateId) {
    const aff = await prisma.affiliate.findUnique({
      where: { id: params.affiliateId },
      select: { customCommissionModel: true, customCommissionValue: true },
    });
    if (aff?.customCommissionModel) model = aff.customCommissionModel;
    if (aff?.customCommissionValue !== undefined && aff.customCommissionValue !== null) value = aff.customCommissionValue;
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    model,
    value,
    recurringDuration: campaign.recurringDuration,
    recurringLimit: campaign.recurringLimit,
    cookieDays: campaign.cookieDays,
    attributionModel: campaign.attributionModel as "first_touch" | "last_touch",
    holdingPeriodDays: campaign.holdingPeriodDays,
    maxCommission: campaign.maxCommission,
    minPayout: campaign.minPayout,
    tier2OverrideRate: campaign.tier2OverrideRate,
    tier3OverrideRate: campaign.tier3OverrideRate,
    overrideFundingModel: campaign.overrideFundingModel,
    maxTierDepth: campaign.maxTierDepth,
  };
}

// --- Performance Tiers ---

export async function upsertPerformanceTier(campaignId: string, input: {
  tierName: string;
  minCustomers?: number;
  minMrr?: number;
  minRevenue?: number;
  commissionValue?: number;
  commissionModel?: string;
  displayOrder?: number;
}) {
  const tierName = input.tierName.toLowerCase().trim();
  if (!["bronze","silver","gold","platinum"].includes(tierName)) throw new Error("Invalid tier name");

  return prisma.affiliatePerformanceTier.upsert({
    where: { campaignId_tierName: { campaignId, tierName } },
    create: {
      campaignId,
      tierName,
      minCustomers: input.minCustomers ?? null,
      minMrr: input.minMrr ?? null,
      minRevenue: input.minRevenue ?? null,
      commissionValue: input.commissionValue ?? null,
      commissionModel: input.commissionModel || null,
      displayOrder: input.displayOrder ?? 0,
    },
    update: {
      minCustomers: input.minCustomers ?? undefined,
      minMrr: input.minMrr ?? undefined,
      minRevenue: input.minRevenue ?? undefined,
      commissionValue: input.commissionValue ?? undefined,
      commissionModel: input.commissionModel ?? undefined,
      displayOrder: input.displayOrder ?? undefined,
    },
  });
}

export async function deletePerformanceTier(campaignId: string, tierName: string) {
  return prisma.affiliatePerformanceTier.deleteMany({
    where: { campaignId, tierName: tierName.toLowerCase().trim() },
  });
}

// --- Campaign Members ---

export async function assignAffiliateToCampaign(affiliateId: string, campaignId: string, opts?: { customRate?: number; assignedBy?: string; expiresAt?: Date }) {
  // Validate both exist
  const [aff, campaign] = await Promise.all([
    prisma.affiliate.findUnique({ where: { id: affiliateId }, select: { id: true } }),
    prisma.affiliateCampaign.findUnique({ where: { id: campaignId }, select: { id: true, status: true } }),
  ]);
  if (!aff) throw new Error("Affiliate not found");
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "active") throw new Error("Campaign must be active");

  // Create membership + update affiliate's campaignId
  const [membership] = await prisma.$transaction([
    prisma.affiliateCampaignMember.create({
      data: {
        affiliateId,
        campaignId,
        customRate: opts?.customRate ?? null,
        assignedBy: opts?.assignedBy || null,
        expiresAt: opts?.expiresAt || null,
      },
    }),
    prisma.affiliate.update({
      where: { id: affiliateId },
      data: { campaignId },
    }),
  ]);

  return membership;
}

export async function removeAffiliateFromCampaign(affiliateId: string, campaignId: string) {
  const [membership] = await prisma.$transaction([
    prisma.affiliateCampaignMember.deleteMany({
      where: { affiliateId, campaignId },
    }),
    prisma.affiliate.update({
      where: { id: affiliateId },
      data: { campaignId: null },
    }),
  ]);
  return membership;
}

export async function listCampaignMembers(campaignId: string) {
  return prisma.affiliateCampaignMember.findMany({
    where: { campaignId },
    include: { affiliate: { select: { id: true, name: true, email: true, referralCode: true, status: true, tier: true } } },
    orderBy: { assignedAt: "desc" },
  });
}
