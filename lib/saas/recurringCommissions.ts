/**
 * Recurring Commission Engine — Phase K
 * Generates commissions on each successful subscription renewal payment.
 * Respects campaign recurringDuration and recurringLimit.
 */

import { prisma } from "@/lib/prisma";
import { calcCommissionAmount } from "./commissions";

/**
 * Generate a recurring commission for a renewal payment.
 * Called from the subscription renewal flow after successful payment.
 */
export async function createRecurringCommission(params: {
  organizationId: string;
  subscriptionId: string;
  paymentId: string;
  mrr: number;
  invoiceId?: string;
}) {
  // Find the original affiliate commission for this organization
  const originalCommission = await prisma.affiliateCommission.findFirst({
    where: {
      organizationId: params.organizationId,
      status: { notIn: ["reversed", "rejected"] },
      affiliateId: { not: null },
    },
    include: {
      affiliate: { select: { id: true, campaignId: true, customCommissionModel: true, customCommissionValue: true, customRecurringDuration: true } },
      campaign: { select: { id: true, recurringDuration: true, recurringLimit: true, commissionModel: true, commissionValue: true, status: true, maxCommission: true, holdingPeriodDays: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!originalCommission) return null; // No affiliate attribution
  if (!originalCommission.affiliateId) return null;

  const aff = originalCommission.affiliate;
  if (!aff) return null;

  // Determine campaign
  const campaign = originalCommission.campaign;
  if (!campaign || campaign.status !== "active") return null;

  const recurringDuration = aff.customRecurringDuration ?? campaign.recurringDuration;
  if (recurringDuration === 0) return null; // First payment only

  // Count existing recurring commissions for this subscription
  const existingRecurringCount = await prisma.affiliateCommission.count({
    where: {
      subscriptionId: params.subscriptionId,
      affiliateId: aff.id,
      commissionType: "recurring",
      status: { notIn: ["reversed", "rejected"] },
    },
  });

  // Check recurring limit
  const recurringLimit = campaign.recurringLimit;
  if (recurringLimit && existingRecurringCount >= recurringLimit) {
    return null; // Limit reached
  }

  // Check duration (-1 = lifetime)
  if (recurringDuration > 0) {
    const monthsElapsed = existingRecurringCount + 1;
    if (monthsElapsed > recurringDuration) {
      return null; // Duration exceeded
    }
  }

  // Calculate commission amount
  const model = aff.customCommissionModel || campaign.commissionModel;
  const value = aff.customCommissionValue ?? campaign.commissionValue;
  let amount = calcCommissionAmount(model, value, params.mrr);

  // Enforce max commission
  if (campaign.maxCommission && amount > campaign.maxCommission) {
    amount = campaign.maxCommission;
  }

  const now = new Date();
  const holdingPeriodDays = campaign.holdingPeriodDays;
  const holdUntil = holdingPeriodDays > 0
    ? new Date(now.getTime() + holdingPeriodDays * 86400000)
    : null;

  const ruleSnapshot = {
    campaignId: campaign.id,
    model,
    value,
    amount,
    mrr: params.mrr,
    type: "recurring",
    recurringIndex: existingRecurringCount + 1,
    recurringDuration,
    recurringLimit,
    resolvedAt: now.toISOString(),
  };

  return prisma.affiliateCommission.create({
    data: {
      affiliateId: aff.id,
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      campaignId: campaign.id,
      amount,
      currency: "USD",
      status: holdUntil ? "pending" : "eligible",
      model,
      commissionType: "recurring",
      ruleSnapshot,
      rate: value,
      base: params.mrr,
      holdUntil,
      eligibleAt: holdUntil ? null : now,
    },
  });
}

/**
 * Advance deferred commissions to eligible status.
 * Called by a cron job to process commissions past their hold period.
 */
export async function advanceDeferredCommissions(batchSize = 100) {
  const now = new Date();
  const ready = await prisma.affiliateCommission.findMany({
    where: {
      status: "pending",
      holdUntil: { not: null, lte: now },
    },
    take: batchSize,
  });

  let advanced = 0;
  for (const c of ready) {
    await prisma.affiliateCommission.update({
      where: { id: c.id },
      data: { status: "eligible", eligibleAt: now },
    });
    advanced++;
  }
  return { advanced, remaining: await prisma.affiliateCommission.count({ where: { status: "pending", holdUntil: { not: null, lte: now } } }) };
}
