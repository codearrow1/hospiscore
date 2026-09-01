/**
 * Leads CRM view-model (shared, side-effect free).
 *
 * All derived CRM signals used by /marketing-admin/leads — stale, overdue,
 * deal age, days in stage, demo status, conversion/subscription status,
 * data-quality flags, next-action, and the KPI/funnel summaries — are computed
 * here from REAL stored data only (timestamps, demos, converted customers).
 * Nothing is invented: when there is no supporting data the value is null/
 * absent, never fabricated.
 *
 * This module is intentionally side-effect free so it can run on the server
 * (page snapshot) AND in the client without divergence.
 */

import type {
  DemoBooking,
  LeadStage,
  MarketingLead,
  ConvertedCustomer,
} from "./types";

export const STALE_DAYS = 14;
export const DUE_SOON_DAYS = 7;
export const DAY_MS = 86_400_000;

/** Demo records (seed:demo-month CLI) are keyed with this prefix. */
export const DEMO_LEAD_PREFIX = "lead-demo-";
export function isDemoLeadId(id: string): boolean {
  return id.startsWith(DEMO_LEAD_PREFIX);
}

export interface FollowUpState {
  status: "none" | "overdue" | "due" | "later";
  daysFromNow: number | null;
}

export function followUpStateOf(
  nextFollowUpAt: string | undefined,
  now = Date.now(),
): FollowUpState {
  if (!nextFollowUpAt) return { status: "none", daysFromNow: null };
  const t = Date.parse(nextFollowUpAt);
  if (Number.isNaN(t)) return { status: "none", daysFromNow: null };
  const days = Math.round((t - now) / DAY_MS);
  if (days < 0) return { status: "overdue", daysFromNow: days };
  if (days <= DUE_SOON_DAYS) return { status: "due", daysFromNow: days };
  return { status: "later", daysFromNow: days };
}

export function isStaleLead(lead: MarketingLead, now = Date.now()): boolean {
  const last =
    Math.max(
      Date.parse(lead.updatedAt || lead.createdAt),
      lead.lastContactAt ? Date.parse(lead.lastContactAt) : 0,
    ) || now;
  return now - last >= STALE_DAYS * DAY_MS;
}

export function lastActivityMs(lead: MarketingLead): number {
  return Math.max(
    Date.parse(lead.updatedAt || lead.createdAt),
    lead.lastContactAt ? Date.parse(lead.lastContactAt) : 0,
  );
}

export function dealAgeDays(lead: MarketingLead, now = Date.now()): number {
  return Math.max(0, Math.round((now - Date.parse(lead.createdAt)) / DAY_MS));
}

export function daysInStage(lead: MarketingLead, now = Date.now()): number {
  return Math.max(0, Math.round((now - Date.parse(lead.updatedAt)) / DAY_MS));
}

export function isOutcomeStage(s: LeadStage): boolean {
  return s === "won" || s === "lost";
}

export type DemoStatusSummary = "none" | "scheduled" | "completed" | "no_show" | "cancelled";

export function demoStatusOf(
  demo: { status: string } | undefined,
  demoId?: string,
): DemoStatusSummary {
  if (!demo) return demoId ? "scheduled" : "none";
  switch (demo.status) {
    case "completed":
      return "completed";
    case "no_show":
      return "no_show";
    case "cancelled":
      return "cancelled";
    default:
      return "scheduled";
  }
}

/** True when the lead converted to a customer (real record link). */
export function isConverted(
  lead: MarketingLead,
  convertedCustomers: readonly ConvertedCustomer[],
): boolean {
  if (lead.convertedCustomerId) return true;
  return convertedCustomers.some((c) => c.leadId === lead.id);
}

/** Data-quality gaps derived from the actual record — never fabricated. */
export interface QualityFlags {
  missingEmail: boolean;
  missingPhone: boolean;
  missingProperty: boolean;
  missingSource: boolean;
  unassigned: boolean;
  noNextStep: boolean;
  incomplete: boolean;
}

export function qualityFlagsOf(lead: MarketingLead): QualityFlags {
  const missingEmail = !lead.email;
  const missingPhone = !lead.phone;
  const missingProperty = !lead.propertyName && !lead.company;
  const missingSource = !lead.source || lead.source === "other";
  const unassigned = !lead.ownerEmail;
  const noNextStep = !lead.nextFollowUpAt && !isOutcomeStage(lead.stage);
  return {
    missingEmail,
    missingPhone,
    missingProperty,
    missingSource,
    unassigned,
    noNextStep,
    incomplete: missingEmail || missingPhone || missingProperty || missingSource,
  };
}

/** The single row shape every leads view renders. */
export interface LeadRow {
  id: string;
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
  planInterest?: string;
  billingCycle?: string;
  source: string;
  stage: LeadStage;
  score: number;
  band: string;
  priority?: "high" | "medium" | "low";
  ownerEmail?: string;
  nextFollowUpAt?: string;
  estimatedValue: number;
  estimatedValueCurrency?: string;
  isDemo: boolean;

  // Derived
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  dealAgeDays: number;
  daysInStage: number;
  stale: boolean;
  followUpStatus: FollowUpState["status"];
  demoStatus: DemoStatusSummary;
  converted: boolean;
  quality: QualityFlags;
}

export function toLeadRow(
  lead: MarketingLead,
  demoByLeadId: ReadonlyMap<string, DemoBooking>,
  converted: readonly ConvertedCustomer[],
  now = Date.now(),
): LeadRow {
  const followUp = followUpStateOf(lead.nextFollowUpAt, now);
  const demo = demoByLeadId.get(lead.id);
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    propertyName: lead.propertyName,
    propertyType: lead.propertyType,
    city: lead.city,
    country: lead.country,
    rooms: lead.rooms,
    currentPms: lead.currentPms,
    planInterest: lead.planInterest,
    billingCycle: lead.billingCycle,
    source: lead.source,
    stage: lead.stage,
    score: lead.score,
    band: lead.band,
    priority: lead.priority,
    ownerEmail: lead.ownerEmail,
    nextFollowUpAt: lead.nextFollowUpAt,
    estimatedValue: lead.estimatedValue,
    estimatedValueCurrency: lead.estimatedValueCurrency,
    isDemo: isDemoLeadId(lead.id),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    lastActivityAt: new Date(lastActivityMs(lead)).toISOString(),
    dealAgeDays: dealAgeDays(lead, now),
    daysInStage: daysInStage(lead, now),
    stale: isStaleLead(lead, now),
    followUpStatus: followUp.status,
    demoStatus: demoStatusOf(demo, lead.demoId),
    converted: isConverted(lead, converted),
    quality: qualityFlagsOf(lead),
  };
}

export function buildLeadRows(
  leads: readonly MarketingLead[],
  demos: readonly DemoBooking[],
  converted: readonly ConvertedCustomer[],
  now = Date.now(),
): LeadRow[] {
  const demoByLeadId = new Map<string, DemoBooking>();
  for (const d of demos) {
    const cur = demoByLeadId.get(d.leadId);
    if (!cur || Date.parse(d.startAt) > Date.parse(cur.startAt)) demoByLeadId.set(d.leadId, d);
  }
  return leads.map((l) => toLeadRow(l, demoByLeadId, converted, now));
}

// ------------------------------------------------------------- summaries --

export interface LeadsKpis {
  total: number;
  newThisWeek: number;
  qualified: number;
  open: number;
  hot: number;
  overdueFollowUps: number;
  won: number;
  conversionRate: number | null;
  closedDeals: number;
}

export function leadsKpis(rows: readonly LeadRow[], now = Date.now()): LeadsKpis {
  const weekStart = new Date(now - 7 * DAY_MS).getTime();
  let total = 0;
  let newThisWeek = 0;
  let qualified = 0;
  let open = 0;
  let hot = 0;
  let overdueFollowUps = 0;
  let won = 0;
  let closedDeals = 0;
  for (const r of rows) {
    total += 1;
    if (Date.parse(r.createdAt) >= weekStart) newThisWeek += 1;
    if (r.stage === "qualified") qualified += 1;
    if (!isOutcomeStage(r.stage)) open += 1;
    if (r.stage === "won") won += 1;
    if (r.band === "hot" || r.band === "very_hot") hot += 1;
    if (r.followUpStatus === "overdue") overdueFollowUps += 1;
    if (r.stage === "won" || r.stage === "lost") closedDeals += 1;
  }
  return {
    total,
    newThisWeek,
    qualified,
    open,
    hot,
    overdueFollowUps,
    won,
    conversionRate: closedDeals > 0 ? (won / closedDeals) * 100 : null,
    closedDeals,
  };
}

export interface FunnelStage {
  stage: LeadStage;
  count: number;
}

/** Optional top-level funnel: real leads per stage in pipeline order. */
export function funnelOf(
  rows: readonly LeadRow[],
  stageOrder: readonly LeadStage[],
): FunnelStage[] {
  const counts = new Map<LeadStage, number>();
  for (const r of rows) counts.set(r.stage, (counts.get(r.stage) ?? 0) + 1);
  return stageOrder
    .map((s) => ({ stage: s, count: counts.get(s) ?? 0 }))
    .filter((f) => f.count > 0);
}

/** Per-currency open pipeline value (never merged across currencies). */
export function openValueByCurrency(
  rows: readonly LeadRow[],
): { currency: string; value: number }[] {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (isOutcomeStage(r.stage)) continue;
    const cur = (r.estimatedValueCurrency ?? "USD").toUpperCase();
    out[cur] = (out[cur] ?? 0) + (r.estimatedValue ?? 0);
  }
  return Object.entries(out)
    .filter(([, v]) => v > 0)
    .map(([currency, value]) => ({ currency, value }));
}
