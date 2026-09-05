/**
 * Backfill the Prisma growth pipeline from the legacy DataFile (checkpoint 3).
 *
 * The checkpoint-1 dual-write mirror only ever persisted rows created AFTER
 * the growth.persist.prisma flag was turned on. This module brings the full
 * historical dataset (leads + converted customers) into the Prisma plane so
 * ADR-0002's AffiliateCommission FK remap can resolve every commission, and
 * re-links any commission whose leadId was left NULL by the migration because
 * the mirror row did not exist yet.
 *
 * Safe to run repeatedly: every step is keyed/deduped on the legacy ids.
 */

import { prisma } from "@/lib/prisma";
import { readData } from "@/lib/db";
import { upsertLeadInPrisma } from "@/lib/growth/prismaStore";
import type { ConvertedCustomer } from "@/lib/marketing/types";

export interface BackfillResult {
  leadsSynced: number;
  convertedCustomersSynced: number;
  relinkedCommissions: number;
  skippedConversionsWithoutLead: number;
}

export async function backfillGrowthData(target?: string): Promise<BackfillResult> {
  const result: BackfillResult = {
    leadsSynced: 0,
    convertedCustomersSynced: 0,
    relinkedCommissions: 0,
    skippedConversionsWithoutLead: 0,
  };

  const d = await readData(target);
  const leads = d.leads ?? [];
  for (const lead of leads) {
    await upsertLeadInPrisma(lead);
    result.leadsSynced += 1;
  }

  for (const c of d.convertedCustomers ?? []) {
    const synced = await backfillConvertedCustomer(c);
    if (synced === "synced") result.convertedCustomersSynced += 1;
    else result.skippedConversionsWithoutLead += 1;
  }

  result.relinkedCommissions = await relinkCommissions();

  return result;
}

async function backfillConvertedCustomer(
  c: ConvertedCustomer,
): Promise<"synced" | "skipped"> {
  if (!c.leadId) return "skipped";
  const lead = await prisma.marketingLead.findUnique({
    where: { legacyLeadId: c.leadId },
    select: { id: true },
  });
  if (!lead) return "skipped";

  const existing = await prisma.marketingConvertedCustomer.findUnique({
    where: { leadId: lead.id },
    select: { id: true },
  });
  if (existing) return "synced";

  await prisma.marketingConvertedCustomer.create({
    data: {
      id: c.id,
      leadId: lead.id,
      convertedAt: new Date(c.convertedAt),
      byEmail: c.byEmail ?? null,
      plan: c.plan ?? null,
      billingCycle: c.billingCycle ?? null,
      country: c.country ?? null,
      estimatedValue: c.estimatedValue ?? 0,
      organizationId: c.organizationId ?? null,
      adminUserId: c.adminUserId ?? null,
      notes: c.notes ?? null,
    },
  });
  return "synced";
}

/**
 * Re-link commissions whose leadId was NULLed by the FK migration because the
 * mirror lead did not exist yet, now that backfill has created those rows.
 */
export async function relinkCommissions(): Promise<number> {
  const dangling = await prisma.affiliateCommission.findMany({
    where: { legacyLeadId: { not: null }, leadId: null },
    select: { id: true, legacyLeadId: true },
  });

  let linked = 0;
  for (const c of dangling) {
    if (!c.legacyLeadId) continue;
    const lead = await prisma.marketingLead.findUnique({
      where: { legacyLeadId: c.legacyLeadId },
      select: { id: true },
    });
    if (!lead) continue;
    await prisma.affiliateCommission.update({
      where: { id: c.id },
      data: { leadId: lead.id },
    });
    linked += 1;
  }
  return linked;
}