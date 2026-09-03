/**
 * Affiliate Attribution Engine — Phase C
 * First-touch / last-touch attribution with lock on subscription creation.
 * Self-referral blocking + coupon-based fallback.
 */

import { prisma } from "@/lib/prisma";

export type AttributionModel = "first_touch" | "last_touch";

/** Check if affiliate is referring their own organization. */
export async function isSelfReferral(affiliateEmail: string, organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { primaryContactId: true },
  });
  if (!org?.primaryContactId) return false;
  const contact = await prisma.orgContact.findUnique({
    where: { id: org.primaryContactId },
    select: { email: true },
  });
  if (!contact) return false;
  return contact.email.toLowerCase() === affiliateEmail.toLowerCase();
}

/**
 * Look up the canonical attribution for an organization.
 * Returns null if no attribution exists (pre-growth-engine rows).
 */
export async function getAttributionForOrg(organizationId: string) {
  return prisma.affiliateAttribution.findUnique({
    where: { organizationId },
    include: {
      affiliate: { select: { id: true, name: true, email: true, referralCode: true } },
      campaign: { select: { id: true, name: true, slug: true } },
    },
  });
}

/**
 * Lock attribution for a newly created subscription.
 * Called once when Subscription.create() fires (first-touch) or on each click (last-touch).
 * Idempotent — returns existing attribution if already locked.
 */
export async function lockAttribution(params: {
  organizationId: string;
  subscriptionId: string;
  affiliateId: string;
  campaignId?: string | null;
  clickId?: string | null;
  touchpoint: "click" | "coupon" | "manual";
  source?: string;
}) {
  // Idempotent — return existing if already locked (race-safe via upsert)
  try {
    return await prisma.affiliateAttribution.upsert({
      where: { organizationId: params.organizationId },
      create: {
        organizationId: params.organizationId,
        affiliateId: params.affiliateId,
        campaignId: params.campaignId || null,
        subscriptionId: params.subscriptionId,
        touchpoint: params.touchpoint,
        clickId: params.clickId || null,
        source: params.source || null,
        lockedAt: new Date(),
      },
      update: {}, // No-op update — first lock wins
    });
  } catch {
    // If upsert fails (concurrent race), fetch existing
    return prisma.affiliateAttribution.findUnique({
      where: { organizationId: params.organizationId },
    });
  }
}

/**
 * Resolve which affiliate gets credit for a subscription creation event.
 * Called from createCommissionForSubscription. Handles:
 * 1. Cookie-based first-touch (existing behavior)
 * 2. Coupon-based fallback
 * 3. Self-referral blocking
 * 4. Campaign-aware resolution
 */
export async function resolveAffiliateForSubscription(params: {
  referralCode?: string | null;
  couponCode?: string | null;
  organizationId: string;
  attributionModel?: AttributionModel;
  organizationEmail?: string;
}): Promise<{
  affiliateId: string | null;
  campaignId: string | null;
  clickId: string | null;
  touchpoint: "click" | "coupon" | "manual";
  source: string | null;
}> {
  let affiliateId: string | null = null;
  let campaignId: string | null = null;
  const clickId: string | null = null;
  let touchpoint: "click" | "coupon" | "manual" = "manual";
  let source: string | null = null;

  // Step 1: Try cookie/referral code
  if (params.referralCode) {
    const aff = await prisma.affiliate.findUnique({
      where: { referralCode: params.referralCode.toUpperCase() },
      select: { id: true, status: true, campaignId: true, email: true },
    });
    if (aff && (aff.status === "active" || aff.status === "approved")) {
      // Self-referral check
      if (params.organizationEmail && aff.email.toLowerCase() === params.organizationEmail.toLowerCase()) {
        // Skip — self-referral
      } else {
        affiliateId = aff.id;
        campaignId = aff.campaignId || null;
        touchpoint = "click";
        source = params.referralCode;
      }
    }
  }

  // Step 2: Coupon-based fallback (if no click attribution found)
  if (!affiliateId && params.couponCode) {
    const aff = await prisma.affiliate.findFirst({
      where: { couponCode: params.couponCode.toUpperCase(), status: { in: ["active", "approved"] } },
      select: { id: true, campaignId: true, email: true },
    });
    if (aff) {
      // Self-referral check
      if (params.organizationEmail && aff.email.toLowerCase() === params.organizationEmail.toLowerCase()) {
        // Skip — self-referral
      } else {
        affiliateId = aff.id;
        campaignId = aff.campaignId || null;
        touchpoint = "coupon";
        source = params.couponCode;
      }
    }
  }

  // Step 3: Last-touch attribution requires email tracking on clicks, which isn't
  // supported by the current AffiliateClick schema (no email field). Fall back to
  // cookie/coupon only. Last-touch will be implemented when click tracking includes
  // email association.

  return { affiliateId, campaignId, clickId, touchpoint, source };
}
