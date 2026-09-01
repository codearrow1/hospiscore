/**
 * Demos workspace view-model (pure, framework-free).
 *
 * Derives schedule KPIs, period classification, follow-up urgency, conflicts
 * and filtering from enriched `DemoRow` records. Everything here is derived
 * from real stored data — never fabricated counts or outcomes.
 */

import type { DemoBooking, DemoStatus, MarketingLead } from "./types";

/** Default demo length in minutes (also the booked-slot default). */
export const DEFAULT_SLOT_MINUTES = 45;

export interface DemoRow {
  id: string;
  leadId: string;
  startAt: string;
  durationMin: number;
  status: DemoStatus;
  demoType?: string;
  assignedTo?: string;
  meetingUrl?: string;
  phone?: string;
  notes?: string;
  city?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  // Lead context (joined server-side; unknown values are string defaults).
  leadName: string;
  leadEmail: string;
  leadCompany?: string;
  leadProperty?: string;
  propertyType?: string;
  rooms?: number;
  currentPms?: string;
  leadStage: string;
  leadBand: string;
  leadScore: number;
  leadSource: string;
  campaign?: string;
  leadOwnerEmail?: string;
  priority?: string;
  estimatedValue: number;
  estimatedValueCurrency?: string;
  nextFollowUpAt?: string;
  lastContactAt?: string;
  convertedCustomerId?: string;
  trialStartedAt?: string;
  ownerName?: string;
  affiliateName?: string;
}

export interface DemoKpis {
  total: number;
  today: number;
  thisWeek: number;
  upcoming: number;
  awaitingConfirmation: number;
  needsFollowUp: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** Completed demos whose lead went on to convert (real, joined). */
  toWon: number;
  /** Completed demos whose lead progressed into trial/negotiation (real). */
  toTrial: number;
}

export interface DemoFilters {
  q?: string;
  status?: string;
  owner?: string;
  period?: string;
  country?: string;
  stage?: string;
  source?: string;
  demoType?: string;
  /** Only demos that currently need a follow-up (real, derived signal). */
  followUp?: boolean;
}

export type DemoSortKey = "startAt" | "createdAt" | "lead" | "status" | "value";
export type SortDir = "asc" | "desc";

const ACTIVE: ReadonlySet<string> = new Set(["new", "confirmed", "reschedule_requested"]);
const CLOSED_LEAD: ReadonlySet<string> = new Set(["won", "lost"]);

/** Statuses that still occupy / demand calendar time. */
export function isDemoActive(status: DemoStatus): boolean {
  return ACTIVE.has(status);
}

export function enrichDemo(
  demo: DemoBooking,
  lead: MarketingLead | null | undefined,
  ctx?: { ownerName?: string; affiliateName?: string },
): DemoRow {
  const l = lead;
  return {
    id: demo.id,
    leadId: demo.leadId,
    startAt: demo.startAt,
    durationMin: demo.durationMin,
    status: demo.status,
    demoType: demo.demoType,
    assignedTo: demo.assignedTo,
    meetingUrl: demo.meetingUrl,
    phone: demo.phone,
    notes: demo.notes,
    city: demo.city,
    country: demo.country,
    createdAt: demo.createdAt,
    updatedAt: demo.updatedAt,
    leadName: l?.name ?? "Unknown lead",
    leadEmail: l?.email ?? "",
    leadCompany: l?.company,
    leadProperty: l?.propertyName,
    propertyType: l?.propertyType,
    rooms: l?.rooms,
    currentPms: l?.currentPms,
    leadStage: l?.stage ?? "new",
    leadBand: l?.band ?? "cold",
    leadScore: l?.score ?? 0,
    leadSource: l?.source ?? "other",
    campaign: l?.attribution?.campaign,
    leadOwnerEmail: l?.ownerEmail,
    priority: l?.priority,
    estimatedValue: l?.estimatedValue ?? 0,
    estimatedValueCurrency: l?.estimatedValueCurrency,
    nextFollowUpAt: l?.nextFollowUpAt,
    lastContactAt: l?.lastContactAt,
    convertedCustomerId: l?.convertedCustomerId,
    trialStartedAt: l?.trialStartedAt,
    ownerName: ctx?.ownerName,
    affiliateName: ctx?.affiliateName,
  };
}

export const DAY_MS = 86_400_000;

/** ISO day key (yyyy-mm-dd) in local time of the provided date. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-based week start (local time). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  return out;
}

export function slotEnd(startAt: string, durationMin: number): number {
  return Date.parse(startAt) + durationMin * 60_000;
}

/** True when demo starts on the same local calendar day as `now`. */
export function startsToday(startAt: string, now: Date): boolean {
  return isoDay(new Date(startAt)) === isoDay(now);
}

/** True when demo start falls within the local week (Mon–Sun) containing `now`. */
export function startsThisWeek(startAt: string, now: Date): boolean {
  const week = startOfWeek(now).getTime();
  const start = Date.parse(startAt);
  return start >= week && start < week + 7 * DAY_MS;
}

/** True when demo starts at/after `now` (a future slot). */
export function startsUpcoming(startAt: string, now: Date): boolean {
  return Date.parse(startAt) >= now.getTime();
}

/**
 * Real, data-driven follow-up signal. A demo needs follow-up when the demo
 * happened recently (completed / no-show) or the client asked to reschedule,
 * the linked lead is still open, and nothing is scheduled to cover the loop
 * (no next follow-up, or the next follow-up is already overdue).
 */
export function demoNeedsFollowUp(
  row: Pick<DemoRow, "startAt" | "status" | "leadStage" | "convertedCustomerId" | "nextFollowUpAt">,
  now: Date,
  sinceDays = 30,
): boolean {
  if (row.status !== "completed" && row.status !== "no_show" && row.status !== "reschedule_requested") {
    return false;
  }
  if (CLOSED_LEAD.has(row.leadStage) || !!row.convertedCustomerId) return false;
  const start = Date.parse(row.startAt);
  if (!Number.isFinite(start)) return false;
  if (start < now.getTime() - sinceDays * DAY_MS || start > now.getTime() + sinceDays * DAY_MS) return false;
  const next = row.nextFollowUpAt ? Date.parse(row.nextFollowUpAt) : null;
  return !next || next <= now.getTime();
}

export function demosKpis(rows: readonly DemoRow[], now: Date): DemoKpis {
  let today = 0;
  let thisWeek = 0;
  let upcoming = 0;
  let awaitingConfirmation = 0;
  let needsFollowUp = 0;
  let completed = 0;
  let noShow = 0;
  let cancelled = 0;
  let toWon = 0;
  let toTrial = 0;
  for (const r of rows) {
    const active = isDemoActive(r.status);
    if (startsToday(r.startAt, now) && r.status !== "cancelled") today += 1;
    if (active && startsThisWeek(r.startAt, now)) thisWeek += 1;
    if (active && startsUpcoming(r.startAt, now)) upcoming += 1;
    if (r.status === "new") awaitingConfirmation += 1;
    if (demoNeedsFollowUp(r, now)) needsFollowUp += 1;
    if (r.status === "completed") {
      completed += 1;
      if (r.convertedCustomerId) toWon += 1;
      if (r.convertedCustomerId || r.trialStartedAt || ["trial", "proposal", "negotiation", "won"].includes(r.leadStage)) toTrial += 1;
    }
    if (r.status === "no_show") noShow += 1;
    if (r.status === "cancelled") cancelled += 1;
  }
  return {
    total: rows.length,
    today,
    thisWeek,
    upcoming,
    awaitingConfirmation,
    needsFollowUp,
    completed,
    noShow,
    cancelled,
    toWon,
    toTrial,
  };
}

export function periodKey(row: Pick<DemoRow, "startAt" | "status">, now: Date): string {
  if (startsToday(row.startAt, now)) return "today";
  if (startsThisWeek(row.startAt, now)) return "week";
  if (startsUpcoming(row.startAt, now)) return "upcoming";
  return "past";
}

export function matchesFilters(row: DemoRow, f: DemoFilters): boolean {
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [
      row.leadName,
      row.leadEmail,
      row.leadCompany,
      row.leadProperty,
      row.city,
      row.country,
      row.campaign,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.status && row.status !== f.status) return false;
  if (f.demoType && !(row.demoType ?? "").toLowerCase().includes(f.demoType.toLowerCase())) return false;
  if (f.owner) {
    if (f.owner === "__none__") {
      if (row.assignedTo) return false;
    } else if (![row.assignedTo, row.leadOwnerEmail].some((e) => e?.toLowerCase() === f.owner!.toLowerCase())) {
      return false;
    }
  }
  if (f.period && periodKey(row, new Date()) !== f.period) return false;
  if (f.country) {
    const inRow = [row.country, row.city].some((v) => v?.toLowerCase() === f.country!.toLowerCase());
    if (!inRow) return false;
  }
  if (f.stage && row.leadStage !== f.stage) return false;
  if (f.source && row.leadSource !== f.source) return false;
  if (f.followUp && !demoNeedsFollowUp(row, new Date())) return false;
  return true;
}

export function filterDemos(rows: readonly DemoRow[], f: DemoFilters): DemoRow[] {
  return rows.filter((r) => matchesFilters(r, f));
}

export function sortDemos(
  rows: readonly DemoRow[],
  sort: DemoSortKey,
  dir: SortDir = "asc",
): DemoRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const out = [...rows];
  out.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "lead":
        cmp = a.leadName.localeCompare(b.leadName);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "value":
        cmp = a.estimatedValue - b.estimatedValue;
        break;
      case "createdAt":
        cmp = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        break;
      default:
        cmp = Date.parse(a.startAt) - Date.parse(b.startAt);
    }
    return cmp * sign;
  });
  return out;
}

export function paginate<T>(rows: readonly T[], page: number, perPage: number): T[] {
  const safePage = Math.max(1, page);
  return rows.slice((safePage - 1) * perPage, safePage * perPage);
}

/**
 * Real overlap detection: another live demo on the same assignee whose time
 * window intersects the candidate's window. Same-empty-assignee demos conflict
 * with each other (unassigned calendar bucket).
 */
export function conflictsFor(
  rows: readonly DemoRow[],
  candidate: { id?: string; assignedTo?: string; startAt: string; durationMin: number },
): DemoRow[] {
  const candStart = Date.parse(candidate.startAt);
  const candEnd = candStart + candidate.durationMin * 60_000;
  if (!Number.isFinite(candStart)) return [];
  const ownerKey = (email?: string) => email?.toLowerCase() ?? "";
  return rows.filter((r) => {
    if (r.id === candidate.id) return false;
    if (!isDemoActive(r.status)) return false;
    if (ownerKey(r.assignedTo) !== ownerKey(candidate.assignedTo)) return false;
    const start = Date.parse(r.startAt);
    const end = start + r.durationMin * 60_000;
    return start < candEnd && candStart < end;
  });
}