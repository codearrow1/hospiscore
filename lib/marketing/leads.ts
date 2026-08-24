/**
 * Marketing lead CRM (Phase 11) — the marketing-specific record that powers
 * the pipeline, dashboard and analytics. Kept logically separate from the
 * operational PMS / guest data; conversion to a customer preserves attribution
 * (see convertLead → ConvertedCustomer).
 */

import { randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import { getPricingDoc } from "@/lib/pricing/db";
import { priceFor, recommendedPlan } from "@/lib/pricing/engine";
import { getPlan, PLAN_IDS } from "@/lib/pricing/catalog";
import type { PlanId, PricingDoc } from "@/lib/pricing/types";
import { applyScoring } from "./scoring";
import { addEvent } from "./events";
import {
  isLeadStage,
  STAGE_LABELS,
  isLostReason,
  WON_STAGE,
  LOST_STAGE,
} from "./stages";
import type {
  LeadSource,
  LeadSourceAttribution,
  LeadStage,
  MarketingLead,
} from "./types";
import type { LostReason } from "./stages";

export type { MarketingLead };

/** Dedupe matching strategy (Phase 16) — email, then phone, then domain. */
export function findExisting(
  leads: readonly MarketingLead[],
  input: { email?: string; phone?: string; company?: string },
): MarketingLead | undefined {
  const email = input.email?.toLowerCase();
  if (email) {
    const byEmail = leads.find((l) => l.email === email);
    if (byEmail) return byEmail;
  }
  const phone = input.phone?.replace(/[^\d+]/g, "");
  if (phone && phone.length >= 6) {
    const byPhone = leads.find((l) => (l.phone ?? "").replace(/[^\d+]/g, "") === phone);
    if (byPhone) return byPhone;
  }
  const domain = email?.split("@")[1];
  if (domain) {
    const byDomain = leads.find((l) => l.email.split("@")[1] === domain);
    if (byDomain) return byDomain;
  }
  return undefined;
}

/** Map a plan name (label or id) to a PlanId. */
export function normalizePlan(plan: string | undefined, rooms?: number): PlanId | undefined {
  if (!plan) return rooms ? recommendedPlan(rooms) : undefined;
  const lower = plan.trim().toLowerCase();
  if ((PLAN_IDS as readonly string[]).includes(lower)) return lower as PlanId;
  const byLabel = getPlan(lower as PlanId) ? (lower as PlanId) : undefined;
  if (byLabel) return byLabel;
  for (const id of PLAN_IDS) {
    const entry = getPlan(id);
    if (entry && entry.name.toLowerCase().replace(/[^a-z]/g, "") === lower.replace(/[^a-z]/g, "")) {
      return id;
    }
  }
  return undefined;
}

/** Estimate annual contract value in USD from pricing catalog (0 = unknown). */
export async function estimateValueForLead(
  lead: Pick<MarketingLead, "country" | "planInterest" | "rooms">,
  doc?: PricingDoc,
  target?: string,
): Promise<number> {
  const pricing: PricingDoc = doc ?? (await getPricingDoc(target));
  const plan = normalizePlan(lead.planInterest, lead.rooms);
  if (!plan || plan === "enterprise") return 0;
  const profile = pricing.profiles[lead.country ?? "US"] ?? pricing.profiles.US;
  if (!profile) return 0;
  return priceFor(profile, plan, "yearly");
}

export interface UpsertInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  propertyName?: string;
  propertyType?: string;
  city?: string;
  country?: string;
  rooms?: number;
  currentPms?: string;
  requiredModules?: string[];
  planInterest?: string;
  billingCycle?: "monthly" | "yearly";
  message?: string;
  source: LeadSource;
  attribution?: LeadSourceAttribution;
  byEmail?: string;
}

/** Create or merge a lead (dedupe by email → phone → domain). */
export async function upsertLead(input: UpsertInput, target?: string): Promise<MarketingLead | null> {
  if (!input.email && !input.phone) return null;
  let nextId: string | null = null;

  await writeData((d) => {
    const leads = d.leads ?? [];
    const existing = findExisting(leads, input);
    const now = new Date().toISOString();

    if (!existing) {
      const base: MarketingLead = {
        id: randomUUID(),
        name: input.name || "Unknown",
        email: input.email.toLowerCase(),
        phone: input.phone,
        company: input.company,
        propertyName: input.propertyName,
        propertyType: input.propertyType,
        city: input.city,
        country: input.country?.toUpperCase(),
        rooms: input.rooms,
        currentPms: input.currentPms,
        requiredModules: input.requiredModules,
        planInterest: normalizePlan(input.planInterest, input.rooms) ?? input.planInterest?.toLowerCase(),
        billingCycle: input.billingCycle,
        message: input.message,
        source: input.source,
        attribution: input.attribution ?? {},
        stage: "new",
        score: 0,
        band: "cold",
        notes: [],
        estimatedValue: 0,
        createdAt: now,
        updatedAt: now,
      };
      const scored = applyScoring(base);
      const lead = { ...base, score: scored.score, band: scored.band };
      nextId = lead.id;
      d.leads = [...leads, lead];
    } else {
      const merged: MarketingLead = {
        ...existing,
        name: input.name || existing.name,
        email: input.email.toLowerCase() || existing.email,
        phone: input.phone || existing.phone,
        company: input.company || existing.company,
        propertyName: input.propertyName || existing.propertyName,
        propertyType: input.propertyType || existing.propertyType,
        city: input.city || existing.city,
        country: (input.country || existing.country)?.toUpperCase(),
        rooms: input.rooms ?? existing.rooms,
        currentPms: input.currentPms || existing.currentPms,
        requiredModules: input.requiredModules ?? existing.requiredModules,
        planInterest: normalizePlan(input.planInterest, input.rooms) ?? existing.planInterest,
        billingCycle: input.billingCycle ?? existing.billingCycle,
        message: input.message || existing.message,
        source: existing.source === "other" ? input.source : existing.source,
        attribution: { ...existing.attribution, ...input.attribution },
        estimatedValue: 0,
        updatedAt: now,
      };
      const scored = applyScoring(merged);
      nextId = existing.id;
      const lead = { ...merged, score: scored.score, band: scored.band };
      d.leads = (d.leads ?? []).map((l) => (l.id === existing.id ? lead : l));
    }
    return d;
  }, target);

  if (!nextId) return null;
  const saved = await getLead(nextId, target);
  if (!saved) return null;
  const estimatedValue = await estimateValueForLead(saved, undefined, target);
  if (estimatedValue >= 0) {
    await writeData(
      (d) => ({
        ...d,
        leads: (d.leads ?? []).map((l) =>
          l.id === saved.id ? { ...l, estimatedValue } : l,
        ),
      }),
      target,
    );
  }

  await addEvent(
    {
      leadId: saved.id,
      type: "created",
      summary: existingSummary(input),
      detail: JSON.stringify(input.attribution ?? {}),
      byEmail: input.byEmail,
    },
    target,
  );
  return saved;
}

function existingSummary(input: UpsertInput): string {
  return `${input.source.replace(/_/g, " ")} submission from ${input.email || input.phone}`;
}

/** Fetch all leads (optionally hydrated). */
export async function listLeads(target?: string): Promise<MarketingLead[]> {
  const data = await readData(target);
  return (data.leads ?? []).sort(
    (a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt),
  );
}

export async function getLead(id: string, target?: string): Promise<MarketingLead | null> {
  const data = await readData(target);
  return (data.leads ?? []).find((l) => l.id === id) ?? null;
}

export interface LeadFilter {
  q?: string;
  stage?: LeadStage | "all";
  source?: LeadSource | "all";
  country?: string;
  plan?: string;
  owner?: string;
  band?: MarketingLead["band"] | "all";
  minScore?: number;
}

export function filterLeads(
  leads: readonly MarketingLead[],
  filter: LeadFilter,
): MarketingLead[] {
  const q = filter.q?.trim().toLowerCase();
  return leads.filter((l) => {
    if (filter.stage && filter.stage !== "all" && l.stage !== filter.stage) return false;
    if (filter.source && filter.source !== "all" && l.source !== filter.source) return false;
    if (filter.country && l.country !== filter.country.toUpperCase()) return false;
    if (filter.plan && l.planInterest !== filter.plan) return false;
    if (filter.owner && l.ownerEmail?.toLowerCase() !== filter.owner.toLowerCase()) return false;
    if (filter.band && filter.band !== "all" && l.band !== filter.band) return false;
    if (typeof filter.minScore === "number" && l.score < filter.minScore) return false;
    if (q) {
      const hay = [
        l.name,
        l.email,
        l.company,
        l.propertyName,
        l.phone,
        l.city,
        l.country,
        l.source,
        l.attribution.campaign,
        l.attribution.landing,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type LeadPatch = Partial<
  Pick<
    MarketingLead,
    | "name"
    | "email"
    | "phone"
    | "company"
    | "propertyName"
    | "propertyType"
    | "city"
    | "country"
    | "rooms"
    | "currentPms"
    | "requiredModules"
    | "planInterest"
    | "billingCycle"
    | "message"
    | "ownerEmail"
    | "nextFollowUpAt"
    | "lastContactAt"
    | "lostReason"
  >
> & { note?: string };

/** Update fields; every change bumps score and emits events where relevant. */
export async function updateLead(
  id: string,
  patch: LeadPatch,
  byEmail?: string,
  target?: string,
): Promise<MarketingLead | null> {
  const lead = await getLead(id, target);
  if (!lead) return null;
  const now = new Date().toISOString();
  const { note, ...rest } = patch;

  const merged: MarketingLead = {
    ...lead,
    ...rest,
    country: rest.country ? rest.country.toUpperCase() : lead.country,
    email: rest.email ? rest.email.toLowerCase() : lead.email,
    updatedAt: now,
  };
  if (note) {
    merged.notes = [...(merged.notes ?? []), `[${now}] ${note}`];
  }
  const scored = applyScoring(merged);
  const updated: MarketingLead = { ...merged, score: scored.score, band: scored.band };

  await writeData(
    (d) => ({
      ...d,
      leads: (d.leads ?? []).map((l) => (l.id === id ? updated : l)),
    }),
    target,
  );

  if (note) {
    await addEvent({ leadId: id, type: "note_added", summary: "Note added", detail: note, byEmail }, target);
  }
  for (const key of ["ownerEmail", "nextFollowUpAt", "rooms", "country", "planInterest"] as const) {
    const before = (lead as unknown as Record<string, unknown>)[key];
    const after = (updated as unknown as Record<string, unknown>)[key];
    if (before !== after) {
      if (key === "ownerEmail") {
        await addEvent(
          { leadId: id, type: "assigned", summary: `Assigned to ${after ?? "unassigned"}`, byEmail },
          target,
        );
      }
      if (key === "nextFollowUpAt") {
        await addEvent(
          { leadId: id, type: "followup_scheduled", summary: `Follow-up scheduled for ${after}`, byEmail },
          target,
        );
      }
    }
  }
  if (lead.score !== updated.score) {
    await addEvent(
      { leadId: id, type: "score_changed", summary: `Score updated to ${updated.score} (${updated.band})`, byEmail },
      target,
    );
  }
  return updated;
}

/** Move a lead along the pipeline, recording the transition. */
export async function moveStage(
  id: string,
  to: LeadStage,
  options: { byEmail?: string; lostReason?: LostReason; detail?: string } = {},
  target?: string,
): Promise<MarketingLead | null> {
  const lead = await getLead(id, target);
  if (!lead) return null;
  if (!isLeadStage(to)) throw new Error("Invalid stage");
  const from = lead.stage;
  if (from === to) return lead;

  let updated: MarketingLead;
  if (to === WON_STAGE || to === LOST_STAGE) {
    updated = {
      ...lead,
      stage: to,
      lostReason: to === LOST_STAGE ? options.lostReason : undefined,
      updatedAt: new Date().toISOString(),
    };
  } else {
    updated = { ...lead, stage: to, lostReason: undefined, updatedAt: new Date().toISOString() };
  }
  const scored = applyScoring(updated);
  updated = { ...updated, score: scored.score, band: scored.band };

  await writeData(
    (d) => ({
      ...d,
      leads: (d.leads ?? []).map((l) => (l.id === id ? updated : l)),
    }),
    target,
  );
  await addEvent(
    {
      leadId: id,
      type: "stage_changed",
      summary: `Moved from ${STAGE_LABELS[from]} to ${STAGE_LABELS[to]}`,
      detail: options.detail,
      byEmail: options.byEmail,
    },
    target,
  );
  return updated;
}

export async function assignLead(
  id: string,
  ownerEmail: string | null,
  byEmail?: string,
  target?: string,
): Promise<MarketingLead | null> {
  return updateLead(id, { ownerEmail: ownerEmail ?? undefined }, byEmail, target);
}

export async function addNote(
  id: string,
  note: string,
  byEmail?: string,
  target?: string,
): Promise<MarketingLead | null> {
  if (!note.trim()) return null;
  return updateLead(id, { note: note.trim() }, byEmail, target);
}

export async function scheduleFollowUp(
  id: string,
  at: string,
  byEmail?: string,
  target?: string,
): Promise<MarketingLead | null> {
  return updateLead(id, { nextFollowUpAt: at }, byEmail, target);
}

export async function recordCommunication(
  id: string,
  kind: "email" | "whatsapp" | "call",
  detail: string,
  byEmail?: string,
  target?: string,
): Promise<MarketingLead | null> {
  const lead = await getLead(id, target);
  if (!lead) return null;
  await updateLead(id, { lastContactAt: new Date().toISOString() }, byEmail, target);
  await addEvent(
    { leadId: id, type: kind === "call" ? "call_logged" : kind === "whatsapp" ? "whatsapp_sent" : "email_sent", summary: `${kind} logged`, detail, byEmail },
    target,
  );
  return getLead(id, target);
}

export async function deleteLead(id: string, target?: string): Promise<boolean> {
  let removed = false;
  await writeData(
    (d) => {
      const before = (d.leads ?? []).length;
      d.leads = (d.leads ?? []).filter((l) => l.id !== id);
      removed = before !== (d.leads?.length ?? 0);
      return d;
    },
    target,
  );
  return removed;
}

/** Mark a converted (won) lead as a customer, preserving attribution. */
export async function convertLead(
  id: string,
  input: { plan?: string; billingCycle?: "monthly" | "yearly"; organizationId?: string; adminUserId?: string; notes?: string; byEmail?: string },
  target?: string,
): Promise<MarketingLead | null> {
  const lead = await getLead(id, target);
  if (!lead) return null;
  const customer = {
    id: randomUUID(),
    leadId: id,
    convertedAt: new Date().toISOString(),
    byEmail: input.byEmail,
    plan: input.plan ?? lead.planInterest,
    billingCycle: input.billingCycle ?? lead.billingCycle,
    country: lead.country,
    estimatedValue: lead.estimatedValue,
    organizationId: input.organizationId,
    adminUserId: input.adminUserId,
    notes: input.notes,
  };
  await writeData(
    (d) => ({
      ...d,
      convertedCustomers: [...(d.convertedCustomers ?? []), customer],
      leads: (d.leads ?? []).map((l) =>
        l.id === id ? { ...l, convertedCustomerId: customer.id, updatedAt: new Date().toISOString() } : l,
      ),
    }),
    target,
  );
  await addEvent(
    { leadId: id, type: "converted", summary: "Converted to customer", detail: input.notes, byEmail: input.byEmail },
    target,
  );
  return getLead(id, target);
}

export async function listConvertedCustomers(target?: string) {
  const data = await readData(target);
  return data.convertedCustomers ?? [];
}

export function leadToCsvRows(leads: readonly MarketingLead[]): string {
  const headers = [
    "createdAt",
    "name",
    "email",
    "phone",
    "company",
    "propertyName",
    "propertyType",
    "city",
    "country",
    "rooms",
    "currentPms",
    "requiredModules",
    "planInterest",
    "billingCycle",
    "message",
    "source",
    "campaign",
    "medium",
    "landing",
    "referrer",
    "stage",
    "score",
    "band",
    "owner",
    "nextFollowUpAt",
    "lastContactAt",
    "estimatedValue",
    "lostReason",
  ];
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const l of leads) {
    lines.push(
      [
        l.createdAt,
        l.name,
        l.email,
        l.phone,
        l.company,
        l.propertyName,
        l.propertyType,
        l.city,
        l.country,
        l.rooms,
        l.currentPms,
        l.requiredModules?.join(";"),
        l.planInterest,
        l.billingCycle,
        l.message,
        l.source,
        l.attribution.campaign,
        l.attribution.medium,
        l.attribution.landing,
        l.attribution.referrer,
        l.stage,
        l.score,
        l.band,
        l.ownerEmail,
        l.nextFollowUpAt,
        l.lastContactAt,
        l.estimatedValue,
        l.lostReason,
      ]
        .map(esc)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export { isLostReason };