/**
 * SaaS Commissions — Phase G + Phase C (campaign-aware)
 * Engine for affiliate/partner/franchise commissions with reversal policy.
 * States: pending → eligible → approved → payable → paid → (reversed/fraud_hold)
 * Reverses on: trial fraud, refund, chargeback, early cancellation per policy.
 */

import { prisma } from "@/lib/prisma";
import { isSelfReferral, lockAttribution, type AttributionModel } from "./attribution";

export type CommissionStatus = "pending" | "eligible" | "approved" | "payable" | "paid" | "rejected" | "reversed" | "fraud_hold";
export const COMMISSION_STATUSES = ["pending","eligible","approved","payable","paid","rejected","reversed","fraud_hold"] as const;

const ALLOWED: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ["eligible","rejected","fraud_hold"],
  eligible: ["approved","rejected","fraud_hold","reversed"],
  approved: ["payable","rejected","reversed"],
  payable: ["paid","rejected","reversed"],
  paid: ["reversed"],
  rejected: [],
  reversed: [],
  fraud_hold: ["eligible","rejected","reversed"],
};

export function canTransitionCommission(from: CommissionStatus, to: CommissionStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function calcCommissionAmount(model: string, value: number, mrr: number): number {
  // value: cents for fixed, or basis points for percent (e.g. 2000 = 20%)
  switch (model) {
    case "fixed": return value;
    case "percent_first": return Math.round((mrr * value) / 10000);
    case "percent_mrr_12": return Math.round((mrr * value * 12) / 10000);
    case "percent_mrr_recurring": return Math.round((mrr * value) / 10000); // per month, caller aggregates
    default: return 0;
  }
}

/**
 * Resolve the effective commission model and value for an affiliate,
 * considering campaign overrides and affiliate-level custom overrides.
 */
async function resolveCommissionParams(affiliateId: string) {
  const aff = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!aff) throw new Error("Affiliate not found");
  if (aff.status !== "active" && aff.status !== "approved") throw new Error("Affiliate not active");

  let model = aff.customCommissionModel || aff.commissionModel;
  let value = aff.customCommissionValue ?? aff.commissionValue;
  let recurringDuration = aff.customRecurringDuration ?? 12;
  let holdingPeriodDays = aff.customHoldingPeriodDays ?? 30;
  let maxCommission = aff.customMaxCommission ?? null;
  const campaignId = aff.campaignId || null;

  // If affiliate has a campaign, resolve campaign-level overrides
  if (campaignId) {
    const campaign = await prisma.affiliateCampaign.findUnique({
      where: { id: campaignId },
      select: {
        commissionModel: true, commissionValue: true,
        recurringDuration: true, holdingPeriodDays: true, maxCommission: true,
        planOverrides: true, countryOverrides: true, status: true,
      },
    });
    if (campaign && campaign.status === "active") {
      // Campaign defaults (affiliate custom overrides take precedence over campaign defaults)
      model = aff.customCommissionModel || campaign.commissionModel;
      value = aff.customCommissionValue ?? campaign.commissionValue;
      recurringDuration = aff.customRecurringDuration ?? campaign.recurringDuration;
      holdingPeriodDays = aff.customHoldingPeriodDays ?? campaign.holdingPeriodDays;
      maxCommission = aff.customMaxCommission ?? campaign.maxCommission;
    }
  }

  return { model, value, recurringDuration, holdingPeriodDays, maxCommission, campaignId, affiliate: aff };
}

/**
 * Award a first-touch commission. Idempotent per (affiliate, organization).
 * Campaign-aware: resolves commission model/value from campaign settings.
 * Creates attribution record for the organization.
 */
export async function createCommissionForSubscription(params: {
  affiliateId: string;
  organizationId: string;
  subscriptionId: string;
  mrr: number;
  organizationEmail?: string;
  attributionModel?: AttributionModel;
  couponCode?: string;
  referralCode?: string;
  clickId?: string;
}) {
  // Self-referral check
  const aff = await prisma.affiliate.findUnique({ where: { id: params.affiliateId } });
  if (!aff) throw new Error("Affiliate not found");
  if (aff.status !== "active" && aff.status !== "approved") throw new Error("Affiliate not active");

  if (params.organizationEmail && await isSelfReferral(aff.email, params.organizationId)) {
    // Self-referral — skip commission entirely
    return null;
  }

  const dupe = await prisma.affiliateCommission.findFirst({
    where: { affiliateId: params.affiliateId, organizationId: params.organizationId, status: { notIn: ["reversed", "rejected"] } },
    select: { id: true },
  });
  if (dupe) return prisma.affiliateCommission.findUnique({ where: { id: dupe.id } });

  const { model, value, recurringDuration, holdingPeriodDays, maxCommission, campaignId } = await resolveCommissionParams(params.affiliateId);

  let amount = calcCommissionAmount(model, value, params.mrr);

  // Enforce commission ceiling
  if (maxCommission && amount > maxCommission) {
    amount = maxCommission;
  }

  // Determine commission type
  const commissionType = params.clickId ? "direct" : "coupon";

  // Create rule snapshot for historical accuracy
  const ruleSnapshot = {
    campaignId,
    model,
    value,
    amount,
    mrr: params.mrr,
    recurringDuration,
    holdingPeriodDays,
    maxCommission,
    resolvedAt: new Date().toISOString(),
  };

  const now = new Date();
  const holdUntil = holdingPeriodDays > 0
    ? new Date(now.getTime() + holdingPeriodDays * 86400000)
    : null;

  const commission = await prisma.affiliateCommission.create({
    data: {
      affiliateId: params.affiliateId,
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      amount,
      currency: "USD",
      status: holdUntil ? "pending" : "eligible",
      model,
      campaignId,
      commissionType,
      ruleSnapshot,
      rate: value,
      base: params.mrr,
      holdUntil,
      eligibleAt: holdUntil ? null : now,
    },
  });

  // Lock attribution for this organization (idempotent)
  await lockAttribution({
    organizationId: params.organizationId,
    subscriptionId: params.subscriptionId,
    affiliateId: params.affiliateId,
    campaignId,
    clickId: params.clickId,
    touchpoint: params.couponCode ? "coupon" : "click",
    source: params.referralCode || params.couponCode || undefined,
  }).catch(() => {}); // Best effort — don't fail commission creation if attribution lock fails

  return commission;
}

export async function listCommissions(opts?: { affiliateId?: string; status?: string; organizationId?: string; campaignId?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.affiliateId) where.affiliateId = opts.affiliateId;
  if (opts?.status) where.status = opts.status;
  if (opts?.organizationId) where.organizationId = opts.organizationId;
  if (opts?.campaignId) where.campaignId = opts.campaignId;
  const [items, total] = await Promise.all([
    prisma.affiliateCommission.findMany({ where, include: { affiliate: { select: { name: true, email: true, referralCode: true } }, organization: { select: { legalName: true } }, subscription: { select: { plan: { select: { name: true } } } }, campaign: { select: { name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.affiliateCommission.count({ where }),
  ]);
  return { items, total };
}

export async function updateCommissionStatus(id: string, to: CommissionStatus) {
  if (!COMMISSION_STATUSES.includes(to as never)) throw new Error("Invalid status");
  const cur = await prisma.affiliateCommission.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw new Error("Commission not found");
  if (!canTransitionCommission(cur.status as CommissionStatus, to)) throw new Error(`Cannot transition ${cur.status} → ${to}`);

  const now = new Date();
  const timestampField: Record<string, Date> = {};
  if (to === "eligible") timestampField.eligibleAt = now;
  if (to === "approved") timestampField.approvedAt = now;
  if (to === "payable") timestampField.payableAt = now;
  if (to === "paid") timestampField.paidAt = now;
  if (to === "reversed") timestampField.reversedAt = now;

  return prisma.affiliateCommission.update({
    where: { id },
    data: { status: to, ...timestampField },
  });
}

export async function reverseCommission(id: string, reason?: string) {
  const cur = await prisma.affiliateCommission.findUnique({ where: { id } });
  if (!cur) throw new Error("Commission not found");
  if (!canTransitionCommission(cur.status as CommissionStatus, "reversed")) {
    throw new Error(`Cannot reverse commission in status ${cur.status}`);
  }
  return prisma.affiliateCommission.update({
    where: { id },
    data: {
      status: "reversed",
      reversedAt: new Date(),
      reversalAmount: cur.amount - cur.paidAmount,
      reversalReason: reason || "manual reversal",
    },
  });
}

// Called on refund/chargeback/early cancellation per policy — auto reverse if configured
export async function handleReversal(organizationId: string, subscriptionId: string) {
  const commissions = await prisma.affiliateCommission.findMany({ where: { organizationId, subscriptionId, status: { in: ["pending","eligible","approved","payable"] } } });
  for (const c of commissions) {
    await prisma.affiliateCommission.update({
      where: { id: c.id },
      data: {
        status: "reversed",
        reversedAt: new Date(),
        reversalAmount: c.amount - c.paidAmount,
        reversalReason: "subscription refunded/chargeback",
      },
    });
  }
  return commissions.length;
}
