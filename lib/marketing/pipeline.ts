/**
 * Sales pipeline view-model (CRM upgrade).
 *
 * One shared, pure view-model drives every pipeline view (Kanban / List /
 * Table) so business logic is never duplicated between them. All derived
 * signals (stale, overdue, next action, stage weights, KPIs) are computed
 * from REAL stored data only — timestamps, events and closed deals. No trend
 * or weight is invented: when there is no supporting data the values are
 * null/absent, never fabricated.
 *
 * This module is intentionally side-effect free so it can run on the server
 * (page snapshot) AND in the client (live recompute after mutations).
 */

import type { LeadEvent, LeadStage, MarketingLead } from "./types";
import {
  ACTIVE_STAGES,
  isLeadStage,
  LOST_STAGE,
  PRIORITIES,
  STAGE_LABELS,
  STAGE_ORDER,
  WON_STAGE,
  type Priority,
} from "./stages";

export const STALE_DAYS = 14;
export const DUE_SOON_DAYS = 7;
export const DAY_MS = 86_400_000;

/** Development demo records (seed:demo-month CLI) are keyed with this prefix. */
export const DEMO_LEAD_PREFIX = "lead-demo-";

export function isDemoLeadId(id: string): boolean {
  return id.startsWith(DEMO_LEAD_PREFIX);
}

// ----------------------------------------------------------- filters -----

export type PriorityFilter = "any" | Priority | "none";

export interface PipelineFilters {
  q?: string;
  /** Owner email, or "__none__" for unassigned. */
  owner?: string;
  /** Active + outcome stages to include (empty = all). */
  stages?: LeadStage[];
  /** Minimum annual estimate in minor units. */
  valueMin?: number;
  /** Maximum annual estimate in minor units. */
  valueMax?: number;
  /** Present only when a currency is specified. */
  currency?: string;
  priority?: PriorityFilter;
  staleOnly?: boolean;
  /** Next follow-up within DUE_SOON_DAYS (including overdue). */
  dueSoonOnly?: boolean;
  createdFrom?: string;
  createdTo?: string;
  /** Last activity (updatedAt/lastContactAt) on or after this date. */
  touchesFrom?: string;
  minScore?: number;
  source?: string;
  /** Exclude development demo records (lead-demo-*). */
  demoExcluded?: boolean;
  /** Show outcome (won/lost) columns. */
  includeOutcomes?: boolean;
}

export interface PipelineDeal {
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
  message?: string;
  source: string;
  score: number;
  band: string;
  priority?: Priority;
  ownerEmail?: string;
  ownerName?: string;
  stage: LeadStage;
  estimatedValue: number;
  estimatedValueCurrency?: string;
  notesCount: number;
  lostReason?: string;
  convertedCustomerId?: string;
  demoId?: string;
  trialStartedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;

  // Derived (computed once in the view-model; shared by all views)
  isDemo: boolean;
  dealAgeDays: number;
  daysInStage: number;
  stale: boolean;
  overdue: boolean;
  dueWithin: boolean;
  followUpStatus: "none" | "overdue" | "due" | "later";
  /** Days until next follow-up (negative = overdue). Null when none set. */
  followUpDays: number | null;
}

export function isStale(
  updatedAt: string,
  lastContactAt: string | undefined,
  now: number,
  days = STALE_DAYS,
): boolean {
  const last = Math.max(Date.parse(updatedAt), lastContactAt ? Date.parse(lastContactAt) : 0);
  return now - last >= days * DAY_MS;
}

/** Follow-up urgency from a real nextFollowUpAt value. */
export function followUpStatusOf(
  nextFollowUpAt: string | undefined,
  now: number,
): { status: PipelineDeal["followUpStatus"]; daysFromNow: number | null } {
  if (!nextFollowUpAt) return { status: "none", daysFromNow: null };
  const at = Date.parse(nextFollowUpAt);
  if (Number.isNaN(at)) return { status: "none", daysFromNow: null };
  const daysFromNow = (at - now) / DAY_MS;
  if (daysFromNow < 0) return { status: "overdue", daysFromNow };
  if (daysFromNow <= DUE_SOON_DAYS) return { status: "due", daysFromNow };
  return { status: "later", daysFromNow };
}

export function toPipelineDeal(
  lead: MarketingLead,
  nameByEmail: ReadonlyMap<string, string>,
  now = Date.now(),
): PipelineDeal {
  const { status, daysFromNow } = followUpStatusOf(lead.nextFollowUpAt, now);
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
    message: lead.message,
    source: lead.source,
    score: lead.score,
    band: lead.band,
    priority: lead.priority,
    ownerEmail: lead.ownerEmail,
    ownerName: lead.ownerEmail ? nameByEmail.get(lead.ownerEmail.toLowerCase()) : undefined,
    stage: lead.stage,
    estimatedValue: lead.estimatedValue,
    estimatedValueCurrency: lead.estimatedValueCurrency,
    notesCount: lead.notes.length,
    lostReason: lead.lostReason,
    convertedCustomerId: lead.convertedCustomerId,
    demoId: lead.demoId,
    trialStartedAt: lead.trialStartedAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    lastContactAt: lead.lastContactAt,
    nextFollowUpAt: lead.nextFollowUpAt,
    isDemo: isDemoLeadId(lead.id),
    dealAgeDays: Math.round((now - Date.parse(lead.createdAt)) / DAY_MS),
    daysInStage: Math.round((now - Date.parse(lead.updatedAt)) / DAY_MS),
    stale: isStale(lead.updatedAt, lead.lastContactAt, now),
    overdue: status === "overdue",
    dueWithin: status === "overdue" || status === "due",
    followUpStatus: status,
    followUpDays: daysFromNow,
  };
}

export function buildViewModel(
  leads: readonly MarketingLead[],
  opts: { users?: { email: string; name: string }[]; now?: number } = {},
): PipelineDeal[] {
  const now = opts.now ?? Date.now();
  const nameByEmail = new Map<string, string>();
  for (const u of opts.users ?? []) nameByEmail.set(u.email.toLowerCase(), u.name);
  return leads.map((l) => toPipelineDeal(l, nameByEmail, now));
}

export function isOwnerMatch(deal: PipelineDeal, owner: string | undefined): boolean {
  if (!owner) return true;
  if (owner === "__none__") return !deal.ownerEmail;
  return (deal.ownerEmail ?? "").toLowerCase() === owner.toLowerCase();
}

/** Apply the compact filter set over the shared view-model. */
export function applyPipelineFilters(
  deals: readonly PipelineDeal[],
  filters: PipelineFilters,
  _now = Date.now(),
): PipelineDeal[] {
  const q = filters.q?.trim().toLowerCase();
  const stageSet = filters.stages && filters.stages.length > 0 ? new Set(filters.stages) : null;
  const cur = filters.currency?.toUpperCase();

  return deals.filter((d) => {
    if (filters.demoExcluded && d.isDemo) return false;
    if (!isOwnerMatch(d, filters.owner)) return false;
    if (stageSet && !stageSet.has(d.stage)) return false;
    if (filters.priority && filters.priority !== "any") {
      if (filters.priority === "none" ? d.priority !== undefined : d.priority !== filters.priority) return false;
    }
    if (cur) {
      if ((d.estimatedValueCurrency ?? "USD").toUpperCase() !== cur) return false;
    }
    if (typeof filters.valueMin === "number" && d.estimatedValue < filters.valueMin) return false;
    if (typeof filters.valueMax === "number" && d.estimatedValue > filters.valueMax) return false;
    if (typeof filters.minScore === "number" && d.score < filters.minScore) return false;
    if (filters.source && d.source !== filters.source) return false;
    if (filters.staleOnly && !d.stale) return false;
    if (filters.dueSoonOnly && !d.dueWithin) return false;
    if (filters.createdFrom && Date.parse(d.createdAt) < Date.parse(filters.createdFrom)) return false;
    if (filters.createdTo && Date.parse(d.createdAt) > Date.parse(filters.createdTo)) return false;
    if (filters.touchesFrom) {
      const touched = Math.max(Date.parse(d.updatedAt), d.lastContactAt ? Date.parse(d.lastContactAt) : 0);
      if (touched < Date.parse(filters.touchesFrom)) return false;
    }
    if (q) {
      const hay = [
        d.name,
        d.email,
        d.company,
        d.propertyName,
        d.propertyType,
        d.city,
        d.country,
        d.phone,
        d.source,
        d.planInterest,
        d.ownerName,
        d.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type PipelineSortField = "name" | "value" | "owner" | "stage" | "updatedAt" | "createdAt" | "score" | "lastActivity" | "followUp";
export type SortDir = "asc" | "desc";

export function sortPipelineDeals(
  deals: readonly PipelineDeal[],
  field: PipelineSortField,
  dir: SortDir,
): PipelineDeal[] {
  const mul = dir === "asc" ? 1 : -1;
  const staged = [...deals];
  staged.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "value":
        cmp = (a.estimatedValue ?? 0) - (b.estimatedValue ?? 0);
        break;
      case "owner":
        cmp = (a.ownerName ?? a.ownerEmail ?? "").localeCompare(b.ownerName ?? b.ownerEmail ?? "");
        break;
      case "stage":
        cmp = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
        break;
      case "score":
        cmp = a.score - b.score;
        break;
      case "createdAt":
        cmp = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        break;
      case "lastActivity":
        cmp = lastActivityMs(a) - lastActivityMs(b);
        break;
      case "followUp":
        cmp = followUpMs(a) - followUpMs(b);
        break;
      default:
        cmp = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    }
    return cmp === 0 ? a.name.localeCompare(b.name) : cmp * mul;
  });
  return staged;
}

function lastActivityMs(d: PipelineDeal): number {
  return Math.max(Date.parse(d.updatedAt), d.lastContactAt ? Date.parse(d.lastContactAt) : 0);
}

function followUpMs(d: PipelineDeal): number {
  return d.nextFollowUpAt ? Date.parse(d.nextFollowUpAt) : Number.POSITIVE_INFINITY;
}

// ------------------------------------------------------- stage grouping --

export function groupByStage(deals: readonly PipelineDeal[]): Record<LeadStage, PipelineDeal[]> {
  const out = {} as Record<LeadStage, PipelineDeal[]>;
  for (const s of STAGE_ORDER) out[s] = [];
  for (const d of deals) out[d.stage]?.push(d);
  return out;
}

/** Per-stage monetary totals grouped by record currency (never merged). */
export interface StageTotals {
  count: number;
  byCurrency: Record<string, number>;
}

export function stageTotals(deals: readonly PipelineDeal[]): Record<LeadStage, StageTotals> {
  const out = {} as Record<LeadStage, StageTotals>;
  for (const s of STAGE_ORDER) out[s] = { count: 0, byCurrency: {} };
  for (const d of deals) {
    const cur = (d.estimatedValueCurrency ?? "USD").toUpperCase();
    const bucket = out[d.stage];
    bucket.count += 1;
    bucket.byCurrency[cur] = (bucket.byCurrency[cur] ?? 0) + (d.estimatedValue ?? 0);
  }
  return out;
}

// ------------------------------------------------------------ outcomes ---

export function isOutcomeStage(stage: LeadStage): boolean {
  return stage === WON_STAGE || stage === LOST_STAGE;
}

export function winRateOf(deals: readonly PipelineDeal[]): { rate: number | null; closed: number } {
  const won = deals.filter((d) => d.stage === WON_STAGE).length;
  const lost = deals.filter((d) => d.stage === LOST_STAGE).length;
  const closed = won + lost;
  return { rate: closed > 0 ? (won / closed) * 100 : null, closed };
}

/** Won records with updatedAt in the current calendar month. */
export function wonThisMonth(
  deals: readonly PipelineDeal[],
  convertedAtList: string[],
  now = Date.now(),
): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const fromStage = deals.filter(
    (x) => x.stage === WON_STAGE && !x.convertedCustomerId,
  ).filter((x) => {
    const t = Date.parse(x.updatedAt);
    return t >= start && t < end;
  }).length;
  const fromCustomers = convertedAtList.filter((iso) => {
    const t = Date.parse(iso);
    return t >= start && t < end;
  }).length;
  return fromStage + fromCustomers;
}

// ------------------------------------------------------- weighted value --

/** Resolve a "Moved from X to Y" / "Moved to Y" target to a stage.
 *  Summaries use stage LABELS ("Demo booked") from moveStage, while older
 *  data may use slugs — both are resolved via STAGE_LABELS / isLeadStage. */
function resolveStageRef(text: string | undefined): LeadStage | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if (!t) return undefined;
  if (isLeadStage(t)) return t;
  const lower = t.toLowerCase();
  for (const s of STAGE_ORDER) {
    if (STAGE_LABELS[s].toLowerCase() === lower) return s;
  }
  return undefined;
}

/** Parse both endpoints out of a "Moved from A to B" summary. */
function parseMoveTargets(summary: string): { from?: LeadStage; to?: LeadStage } {
  const m = summary.match(/\bfrom (.+?) to (.+)$/i);
  if (m) return { from: resolveStageRef(m[1]), to: resolveStageRef(m[2]) };
  const i = summary.lastIndexOf(" to ");
  if (i >= 0) return { to: resolveStageRef(summary.slice(i + 4)) };
  return {};
}

/**
 * Per-stage win weights derived from REAL closed deals.
 *
 * A lead's trajectory is reconstructed from its `stage_changed` events (the
 * stage each deal actually moved through). For every non-terminal stage S:
 *   weight(S) = (# deals that reached S and eventually won) /
 *               (# deals that reached S and eventually won or lost)
 * Leads with no event trail contribute only their terminal stage, so partial
 * data narrows the sample instead of skewing it. When a stage has no closed
 * evidence its weight is null (never invented).
 */
export function stageWinWeights(
  leads: readonly MarketingLead[],
  events: readonly LeadEvent[],
): { weights: Partial<Record<LeadStage, number>>; sample: number } {
  const reached = new Map<string, Set<LeadStage>>();
  for (const e of events) {
    if (e.type !== "stage_changed") continue;
    const { from, to } = parseMoveTargets(e.summary ?? "");
    if (!to) continue;
    let set = reached.get(e.leadId);
    if (!set) {
      set = new Set();
      reached.set(e.leadId, set);
    }
    set.add(to);
    if (from) set.add(from);
  }

  const counters: Record<string, { won: number; closed: number }> = {};
  for (const s of ACTIVE_STAGES) counters[s] = { won: 0, closed: 0 };

  let sample = 0;
  for (const lead of leads) {
    const terminal = lead.stage;
    if (terminal !== WON_STAGE && terminal !== LOST_STAGE) continue;
    const stages = new Set(reached.get(lead.id) ?? []);
    stages.add(terminal);
    for (const s of ACTIVE_STAGES) {
      if (!stages.has(s)) continue;
      const c = counters[s];
      c.closed += 1;
      if (terminal === WON_STAGE) c.won += 1;
    }
    sample += 1;
  }

  const weights: Partial<Record<LeadStage, number>> = {};
  for (const s of ACTIVE_STAGES) {
    const c = counters[s];
    if (c.closed > 0) weights[s] = c.won / c.closed;
  }
  return { weights, sample };
}

// ---------------------------------------------------------------- KPIs ---

export interface PipelineKpis {
  open: number;
  /** Annual pipeline value per record currency (minor units). */
  valueByCurrency: Record<string, number>;
  /** Weighted pipeline value per currency (minor units) — null weight ⇒ excluded. */
  weightedByCurrency: Record<string, number>;
  weightedAvailable: boolean;
  dueSoon: number;
  stale: number;
  wonThisMonth: number;
  winRate: number | null;
  winRateSample: number;
  outcomes: { won: number; lost: number };
}

export function pipelineKpis(
  deals: readonly PipelineDeal[],
  weights?: Partial<Record<LeadStage, number>>,
  opts: { wonThisMonth?: number; now?: number } = {},
): PipelineKpis {
  const openDeals = deals.filter((d) => !isOutcomeStage(d.stage));

  const valueByCurrency: Record<string, number> = {};
  const weightedByCurrency: Record<string, number> = {};
  let weightedAvailable = true;
  for (const d of openDeals) {
    const val = d.estimatedValue ?? 0;
    const cur = (d.estimatedValueCurrency ?? "USD").toUpperCase();
    valueByCurrency[cur] = (valueByCurrency[cur] ?? 0) + val;
    if (weights) {
      const w = weights[d.stage];
      if (w === undefined || w === null) {
        weightedAvailable = false;
      } else {
        weightedByCurrency[cur] = (weightedByCurrency[cur] ?? 0) + val * w;
      }
    }
  }

  const { rate, closed } = winRateOf(deals);
  return {
    open: openDeals.length,
    valueByCurrency,
    weightedByCurrency,
    weightedAvailable: Boolean(weights) && weightedAvailable,
    dueSoon: openDeals.filter((d) => d.dueWithin).length,
    stale: openDeals.filter((d) => d.stale).length,
    wonThisMonth: opts.wonThisMonth ?? 0,
    winRate: rate,
    winRateSample: closed,
    outcomes: {
      won: deals.filter((d) => d.stage === WON_STAGE).length,
      lost: deals.filter((d) => d.stage === LOST_STAGE).length,
    },
  };
}

/** Count of non-default filters for the compact "Filters (n)" badge. */
export function activeFilterCount(f: PipelineFilters): number {
  let n = 0;
  if (f.q) n += 1;
  if (f.owner) n += 1;
  if (f.stages?.length) n += 1;
  if (typeof f.valueMin === "number" || typeof f.valueMax === "number") n += 1;
  if (f.currency) n += 1;
  if (f.priority && f.priority !== "any") n += 1;
  if (f.staleOnly) n += 1;
  if (f.dueSoonOnly) n += 1;
  if (f.createdFrom || f.createdTo) n += 1;
  if (f.touchesFrom) n += 1;
  if (typeof f.minScore === "number") n += 1;
  if (f.source) n += 1;
  if (f.demoExcluded) n += 1;
  return n;
}

export const emptyFilters = (): PipelineFilters => ({
  q: "",
  owner: "",
  stages: [],
  priority: "any",
  staleOnly: false,
  dueSoonOnly: false,
  minScore: undefined,
  demoExcluded: false,
  includeOutcomes: true,
});

// ----------------------------------------------------------------- CSV ---

export interface CsvLeadRow {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  propertyName?: string;
  propertyType?: string;
  city?: string;
  country?: string;
  rooms?: number;
  currentPms?: string;
  planInterest?: string;
  billingCycle?: "monthly" | "yearly";
  message?: string;
  source?: string;
  stage?: LeadStage;
  priority?: Priority;
  estimatedValue?: number;
  estimatedValueCurrency?: string;
}

export interface CsvParseResult {
  rows: CsvLeadRow[];
  headers: string[];
  skipped: number;
  error?: string;
}

/** RFC-4180-ish line splitter (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const CSV_ALIASES: Record<string, keyof CsvLeadRow> = {
  name: "name",
  "lead name": "name",
  email: "email",
  phone: "phone",
  phonewhatsapp: "phone",
  company: "company",
  propertyname: "propertyName",
  property: "propertyName",
  propertytype: "propertyType",
  city: "city",
  country: "country",
  rooms: "rooms",
  currentpms: "currentPms",
  planinterest: "planInterest",
  plan: "planInterest",
  billingcycle: "billingCycle",
  message: "message",
  source: "source",
  stage: "stage",
  priority: "priority",
  estimatedvalue: "estimatedValue",
  estimatedvaluecurrency: "estimatedValueCurrency",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse an exported (or hand-built) leads CSV into import rows. */
export function parseLeadsCsv(text: string): CsvParseResult {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { rows: [], headers: [], skipped: 0, error: "The file is empty" };

  const headers = parsed[0].map((h) => normalizeHeader(h));
  if (!headers.some((h) => CSV_ALIASES[h] === "name" || CSV_ALIASES[h] === "email")) {
    return { rows: [], headers, skipped: 0, error: "CSV must include at least a name or email column" };
  }

  const toField = (idx: number): keyof CsvLeadRow | undefined => CSV_ALIASES[headers[idx]];
  const rows: CsvLeadRow[] = [];
  let skipped = 0;
  for (const rec of parsed.slice(1)) {
    const out: CsvLeadRow = {};
    let hasContent = false;
    rec.forEach((value, idx) => {
      const field = toField(idx);
      if (!field) return;
      const v = value?.trim();
      if (v === "") return;
      hasContent = true;
      if (field === "rooms") {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) out.rooms = Math.round(n);
      } else if (field === "estimatedValue") {
        const n = Number(v);
        if (Number.isFinite(n)) out.estimatedValue = n;
      } else if (field === "billingCycle") {
        if (v === "monthly" || v === "yearly") out.billingCycle = v;
      } else if (field === "stage") {
        if (isLeadStage(v)) out.stage = v;
      } else if (field === "priority") {
        if ((PRIORITIES as readonly string[]).includes(v)) out.priority = v as Priority;
      } else if (field === "source") {
        out.source = v;
      } else {
        (out as Record<string, string | number | undefined>)[field] = v as string;
      }
    });
    if (hasContent && (out.name || out.email || out.phone)) rows.push(out);
    else skipped += 1;
  }
  return { rows, headers, skipped };
}