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
  // Find the original affiliate commission for this subscription (not just the org)
  const originalCommission = await prisma.affiliateCommission.findFirst({
    where: {
      subscriptionId: params.subscriptionId,
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

  const now = new Date();

  // Holding period only applies to the first (direct) commission — recurring renewals
  // skip it since the subscriber is already retained beyond the initial hold window.
  const holdUntil = null;

  // Calculate commission amount
  const model = aff.customCommissionModel || campaign.commissionModel;
  const value = aff.customCommissionValue ?? campaign.commissionValue;
  let amount = calcCommissionAmount(model, value, params.mrr);

  // Enforce max commission
  if (campaign.maxCommission && amount > campaign.maxCommission) {
    amount = campaign.maxCommission;
  }

  // Atomic count + create in transaction to prevent race condition
  return prisma.$transaction(async (tx) => {
    const existingRecurringCount = await tx.affiliateCommission.count({
      where: {
        subscriptionId: params.subscriptionId,
        affiliateId: aff.id,
        commissionType: "recurring",
        status: { notIn: ["reversed", "rejected"] },
      },
    });

    const recurringLimit = campaign.recurringLimit;
    if (recurringLimit && existingRecurringCount >= recurringLimit) {
      return null; // Limit reached
    }

    if (recurringDuration > 0) {
      const monthsElapsed = existingRecurringCount + 1;
      if (monthsElapsed > recurringDuration) {
        return null; // Duration exceeded
      }
    }

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

    return tx.affiliateCommission.create({
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
  }, { maxWait: 20_000, timeout: 60_000 });
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
    select: { id: true },
    take: batchSize,
  });
  if (ready.length === 0) return { advanced: 0, remaining: 0 };

  const ids = ready.map((c) => c.id);
  await prisma.affiliateCommission.updateMany({
    where: { id: { in: ids } },
    data: { status: "eligible", eligibleAt: now },
  });

  return {
    advanced: ids.length,
    remaining: await prisma.affiliateCommission.count({
      where: { status: "pending", holdUntil: { not: null, lte: now } },
    }),
  };
}
