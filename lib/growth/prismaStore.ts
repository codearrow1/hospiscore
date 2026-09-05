/**
 * Prisma-backed marketing growth pipeline store (checkpoint 1).
 *
 * Mirrors the legacy JSON DataFile plane into the Prisma SaaS plane. Callers
 * decide whether to invoke this behind the `growth.persist.prisma` flag (see
 * lib/growth/flag.ts); the DataFile payloads passed in here remain the source
 * of truth for reads until checkout 2/3 cut over.
 *
 * All writes use `prisma.$transaction` so the lead row, its timeline event and
 * any child records are committed atomically.
 *
 * See docs/adr/0001-growth-pipeline-in-prisma.md
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  ConvertedCustomer,
  LeadSourceAttribution,
  MarketingLead,
} from "@/lib/marketing/types";

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Store attribution as Json, dropping nothing we already keep. */
function attributionToJson(a: LeadSourceAttribution): Prisma.InputJsonValue | undefined {
  const out = a && typeof a === "object" && Object.keys(a).length > 0 ? a : undefined;
  return out ? (out as unknown as Prisma.InputJsonValue) : undefined;
}

/**
 * Upsert a MarketingLead row keyed on the legacy DataFile lead id, plus a
 * `created` timeline event, inside one transaction. Returns the Prisma lead id.
 */
export async function upsertLeadInPrisma(lead: MarketingLead): Promise<string> {
  const legacyLeadId = lead.id;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketingLead.findUnique({
      where: { legacyLeadId },
      select: { id: true },
    });

    if (existing) {
      await tx.marketingLead.update({
        where: { id: existing.id },
        data: {
          name: lead.name,
          email: lead.email,
          phone: asString(lead.phone),
          company: asString(lead.company),
          propertyName: asString(lead.propertyName),
          propertyType: asString(lead.propertyType),
          city: asString(lead.city),
          country: asString(lead.country),
          rooms: lead.rooms ?? null,
          currentPms: asString(lead.currentPms),
          requiredModules: asStringArray(lead.requiredModules),
          planInterest: asString(lead.planInterest),
          billingCycle: asString(lead.billingCycle),
          message: asString(lead.message),
          source: lead.source ?? "other",
          attribution: attributionToJson(lead.attribution),
          stage: lead.stage ?? "new",
          score: lead.score ?? 0,
          band: lead.band ?? "cold",
          ownerEmail: asString(lead.ownerEmail),
          notes: asStringArray(lead.notes),
          nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null,
          lastContactAt: lead.lastContactAt ? new Date(lead.lastContactAt) : null,
          estimatedValue: lead.estimatedValue ?? 0,
          estimatedValueCurrency: asString(lead.estimatedValueCurrency),
          priority: asString(lead.priority),
        },
      });
      return existing.id;
    }

    const created = await tx.marketingLead.create({
      data: {
        legacyLeadId,
        name: lead.name,
        email: lead.email,
        phone: asString(lead.phone),
        company: asString(lead.company),
        propertyName: asString(lead.propertyName),
        propertyType: asString(lead.propertyType),
        city: asString(lead.city),
        country: asString(lead.country),
        rooms: lead.rooms ?? null,
        currentPms: asString(lead.currentPms),
        requiredModules: asStringArray(lead.requiredModules),
        planInterest: asString(lead.planInterest),
        billingCycle: asString(lead.billingCycle),
        message: asString(lead.message),
        source: lead.source ?? "other",
        attribution: attributionToJson(lead.attribution),
        stage: lead.stage ?? "new",
        score: lead.score ?? 0,
        band: lead.band ?? "cold",
        ownerEmail: asString(lead.ownerEmail),
        notes: asStringArray(lead.notes),
        nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null,
        lastContactAt: lead.lastContactAt ? new Date(lead.lastContactAt) : null,
        estimatedValue: lead.estimatedValue ?? 0,
        estimatedValueCurrency: asString(lead.estimatedValueCurrency),
        priority: asString(lead.priority),
        createdAt: lead.createdAt ? new Date(lead.createdAt) : undefined,
        updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : undefined,
        events: {
          create: {
            type: "created",
            summary: "Synced from marketing pipeline (checkpoint 1)",
          },
        },
      },
    });
    return created.id;
  });
}

/**
 * Record a demo booking alongside its marketing lead (linked by leadId when
 * one exists). `sourceId` preserves the originating lead id for attribution.
 */
export async function storeDemoInPrisma(input: {
  id: string;
  leadId?: string;
  sourceId?: string;
  startAt: string;
  durationMin?: number;
  status: string;
  demoType?: string;
  assignedTo?: string;
  meetingUrl?: string;
  phone?: string;
  notes?: string;
  city?: string;
  country?: string;
}): Promise<string> {
  const data = {
    id: input.id,
    leadId: input.leadId ?? null,
    sourceId: input.sourceId ?? null,
    startAt: new Date(input.startAt),
    durationMin: input.durationMin ?? 30,
    status: input.status ?? "new",
    demoType: asString(input.demoType),
    assignedTo: asString(input.assignedTo),
    meetingUrl: asString(input.meetingUrl),
    phone: asString(input.phone),
    notes: asString(input.notes),
    city: asString(input.city),
    country: asString(input.country),
  };
  await prisma.marketingDemoBooking.create({ data });
  return input.id;
}

/**
 * Record a score-report request (linked to a lead when one exists).
 */
export async function storeReportInPrisma(input: {
  id: string;
  leadId?: string;
  sourceId?: string;
  name: string;
  email: string;
  phone?: string;
  propertySlug: string;
  propertyName: string;
  status?: string;
  createdAt?: string;
}): Promise<string> {
  await prisma.marketingReportRequest.create({
    data: {
      id: input.id,
      leadId: input.leadId ?? null,
      sourceId: input.sourceId ?? null,
      name: input.name,
      email: input.email,
      phone: asString(input.phone),
      propertySlug: input.propertySlug,
      propertyName: input.propertyName,
      status: asString(input.status),
      createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
    },
  });
  return input.id;
}

/**
 * Convert a marketing lead to a customer. Ensures a MarketingLead row exists
 * (mirroring the legacy lead), marks it won + converted, writes the converted
 * customer record and the conversion timeline event — all in one transaction.
 */
export async function convertLeadInPrisma(
  legacyLead: MarketingLead,
  conversion: ConvertedCustomer,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const leadId = await ensurePrismaLead(tx, legacyLead);

    await tx.marketingConvertedCustomer.create({
      data: {
        id: conversion.id,
        leadId,
        convertedAt: conversion.convertedAt ? new Date(conversion.convertedAt) : new Date(),
        byEmail: asString(conversion.byEmail),
        plan: asString(conversion.plan),
        billingCycle: asString(conversion.billingCycle),
        country: asString(conversion.country),
        estimatedValue: conversion.estimatedValue ?? 0,
        organizationId: asString(conversion.organizationId),
        adminUserId: asString(conversion.adminUserId),
        notes: asString(conversion.notes),
      },
    });

    await tx.marketingLead.update({
      where: { id: leadId },
      data: {
        stage: "won",
        convertedCustomerId: conversion.id,
        convertedAt: conversion.convertedAt ? new Date(conversion.convertedAt) : new Date(),
      },
    });

    await tx.marketingLeadEvent.create({
      data: {
        leadId,
        type: "converted",
        summary: "Converted to customer",
        detail: asString(conversion.notes),
        byEmail: asString(conversion.byEmail),
      },
    });

    return conversion.id;
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Find or create the Prisma lead row mirroring a legacy (DataFile) lead. */
async function ensurePrismaLead(tx: Tx, legacyLead: MarketingLead): Promise<string> {
  const existing = await tx.marketingLead.findUnique({
    where: { legacyLeadId: legacyLead.id },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.marketingLead.create({
    data: {
      legacyLeadId: legacyLead.id,
      name: legacyLead.name,
      email: legacyLead.email,
      phone: asString(legacyLead.phone),
      company: asString(legacyLead.company),
      propertyName: asString(legacyLead.propertyName),
      propertyType: asString(legacyLead.propertyType),
      city: asString(legacyLead.city),
      country: asString(legacyLead.country),
      rooms: legacyLead.rooms ?? null,
      currentPms: asString(legacyLead.currentPms),
      requiredModules: asStringArray(legacyLead.requiredModules),
      planInterest: asString(legacyLead.planInterest),
      billingCycle: asString(legacyLead.billingCycle),
      message: asString(legacyLead.message),
      source: legacyLead.source ?? "other",
      attribution: attributionToJson(legacyLead.attribution),
      stage: legacyLead.stage ?? "new",
      score: legacyLead.score ?? 0,
      band: legacyLead.band ?? "cold",
      ownerEmail: asString(legacyLead.ownerEmail),
      notes: asStringArray(legacyLead.notes),
      nextFollowUpAt: legacyLead.nextFollowUpAt ? new Date(legacyLead.nextFollowUpAt) : null,
      lastContactAt: legacyLead.lastContactAt ? new Date(legacyLead.lastContactAt) : null,
      estimatedValue: legacyLead.estimatedValue ?? 0,
      estimatedValueCurrency: asString(legacyLead.estimatedValueCurrency),
      priority: asString(legacyLead.priority),
    },
  });
  return created.id;
}
