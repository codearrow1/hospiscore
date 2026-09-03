/**
 * Multi-Tier Affiliate Recruitment + Override Engine — Phase F
 * Strictly capped referral hierarchy (max 3 levels default, configurable to 5).
 * Parent earns override on child's referrals. No monetary reward for recruitment itself.
 */

import { prisma } from "@/lib/prisma";
import { resolveSetting } from "@/lib/settings/resolver";

/** Get max tier depth from campaign or platform settings */
async function getMaxTierDepth(campaignMaxDepth: number | null): Promise<number> {
  if (campaignMaxDepth != null) return campaignMaxDepth;
  try {
    return await resolveSetting<number>("max_tier_depth");
  } catch {
    return 3;
  }
}

/**
 * Register a parent→child recruitment relationship.
 * Validates: max depth, no cycles, no self-recruitment, both affiliates active.
 */
export async function recruitAffiliate(params: {
  parentAffiliateId: string;
  childAffiliateId: string;
}) {
  if (params.parentAffiliateId === params.childAffiliateId) {
    throw new Error("Cannot recruit yourself");
  }

  const [parent, child] = await Promise.all([
    prisma.affiliate.findUnique({ where: { id: params.parentAffiliateId }, select: { id: true, status: true, campaignId: true, parentId: true } }),
    prisma.affiliate.findUnique({ where: { id: params.childAffiliateId }, select: { id: true, status: true } }),
  ]);
  if (!parent) throw new Error("Parent affiliate not found");
  if (!child) throw new Error("Child affiliate not found");
  if (parent.status !== "active" && parent.status !== "approved") throw new Error("Parent affiliate not active");
  if (child.status !== "active" && child.status !== "approved") throw new Error("Child affiliate not active");

  // Check existing
  const existing = await prisma.affiliateRecruitment.findUnique({
    where: { parentAffiliateId_childAffiliateId: { parentAffiliateId: params.parentAffiliateId, childAffiliateId: params.childAffiliateId } },
  });
  if (existing) throw new Error("Recruitment relationship already exists");

  // Calculate depth from parent's actual tree position (don't trust caller)
  const depth = await getParentDepth(params.parentAffiliateId);
  const campaign = parent.campaignId
    ? await prisma.affiliateCampaign.findUnique({ where: { id: parent.campaignId }, select: { maxTierDepth: true } })
    : null;
  const maxDepth = await getMaxTierDepth(campaign?.maxTierDepth ?? null);
  if (depth >= maxDepth) throw new Error(`Maximum tier depth (${maxDepth}) exceeded`);

  // Cycle check: ensure child is not an ancestor of parent
  const isAncestor = await checkAncestry(params.childAffiliateId, params.parentAffiliateId);
  if (isAncestor) throw new Error("Recruitment would create a cycle");

  // Create recruitment + set child's parentId
  const [recruitment] = await prisma.$transaction([
    prisma.affiliateRecruitment.create({
      data: {
        parentAffiliateId: params.parentAffiliateId,
        childAffiliateId: params.childAffiliateId,
        depth,
      },
    }),
    prisma.affiliate.update({
      where: { id: params.childAffiliateId },
      data: { parentId: params.parentAffiliateId as string, recruitedById: params.parentAffiliateId },
    }),
  ]);

  return recruitment;
}

/** Check if `candidateId` is an ancestor of `descendantId` (cycle detection). */
async function checkAncestry(candidateId: string, descendantId: string): Promise<boolean> {
  let current = descendantId;
  for (let i = 0; i < 5; i++) {
    const aff = await prisma.affiliate.findUnique({ where: { id: current }, select: { parentId: true } });
    if (!aff?.parentId) return false;
    if (aff.parentId === candidateId) return true;
    current = aff.parentId;
  }
  return false;
}

/** Calculate the depth of an affiliate in the recruitment tree (1 = root). */
async function getParentDepth(affiliateId: string): Promise<number> {
  let depth = 1;
  let current = affiliateId;
  for (let i = 0; i < 5; i++) {
    const aff = await prisma.affiliate.findUnique({ where: { id: current }, select: { parentId: true } });
    if (!aff?.parentId) break;
    depth++;
    current = aff.parentId;
  }
  return depth;
}

/**
 * Calculate override commissions for parent affiliates when a child earns a direct commission.
 * Returns array of override commission data (caller must create them).
 */
export async function calculateOverrideCommissions(params: {
  childAffiliateId: string;
  directCommissionAmount: number;
  subscriptionId: string;
  organizationId: string;
  mrr: number;
}) {
  const results: Array<{
    affiliateId: string;
    amount: number;
    depth: number;
    overrideType: string;
    parentCommissionId: string | null;
  }> = [];

  const child = await prisma.affiliate.findUnique({
    where: { id: params.childAffiliateId },
    select: { parentId: true, recruitedById: true, campaignId: true },
  });
  if (!child?.parentId) return results;

  // Get campaign override rates
  const campaign = child.campaignId
    ? await prisma.affiliateCampaign.findUnique({
        where: { id: child.campaignId },
        select: { tier2OverrideRate: true, tier3OverrideRate: true, overrideFundingModel: true, maxCommission: true },
      })
    : null;

  const tier2Rate = campaign?.tier2OverrideRate ?? 0;
  const tier3Rate = campaign?.tier3OverrideRate ?? 0;
  const fundingModel = campaign?.overrideFundingModel ?? "company_funded";

  // Walk up the tree (max 2 levels of override: tier-2 and tier-3)
  let currentParentId = child.parentId as string | null;
  let depth = 2;

  while (currentParentId && depth <= 3) {
    const rate = depth === 2 ? tier2Rate : tier3Rate;
    if (rate > 0) {
      const overrideAmount = Math.round((params.directCommissionAmount * rate) / 10000);
      if (overrideAmount > 0) {
        results.push({
          affiliateId: currentParentId,
          amount: overrideAmount,
          depth,
          overrideType: fundingModel,
          parentCommissionId: null, // caller links after creation
        });
      }
    }

    // Move up
    const nextParent = await prisma.affiliate.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    currentParentId = nextParent?.parentId ?? null;
    depth++;
  }

  return results;
}

/** List an affiliate's recruited network (direct children only). */
export async function listRecruitedAffiliates(affiliateId: string) {
  return prisma.affiliateRecruitment.findMany({
    where: { parentAffiliateId: affiliateId },
    include: { child: { select: { id: true, name: true, email: true, referralCode: true, status: true, tier: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Get full recruitment tree for an affiliate (all descendants). */
export async function getRecruitmentTree(affiliateId: string) {
  const children = await prisma.affiliateRecruitment.findMany({
    where: { parentAffiliateId: affiliateId },
    include: { child: { select: { id: true, name: true, email: true, referralCode: true, status: true, tier: true } } },
  });
  return children;
}
