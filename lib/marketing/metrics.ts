/**
 * Marketing analytics (Phases 2 + 26 + 38) — every number is computed from the
 * captured store (leads, demos, campaigns, page views) or explicitly zero;
 * nothing is fabricated. Chart-ready series are returned as plain arrays.
 */

import { readData } from "@/lib/db";
import { listLeads, listConvertedCustomers } from "./leads";
import { listDemos } from "./demos";
import { STAGE_ORDER, STAGE_LABELS } from "./stages";
import { totalPipelineValue } from "./campaigns";
import type { PageView } from "./types";

export interface DashboardMetrics {
  generatedAt: string;
  range?: { from?: string; to?: string };
  kpis: {
    newLeadsToday: number;
    newLeads7d: number;
    totalLeads: number;
    qualified: number;
    demoRequests: number;
    trials: number;
    conversions: number;
    won: number;
    lost: number;
    followUpsDue: number;
    pipelineValue: number;
    winRate: number | null;
    avgDaysToWon: number | null;
    topLanding: { key: string; count: number } | null;
    topSource: { key: string; count: number } | null;
    topCountry: { key: string; count: number } | null;
    topPlan: { key: string; count: number } | null;
  };
  funnel: { stage: (typeof STAGE_ORDER)[number]; label: string; count: number }[];
  velocity: { stage: (typeof STAGE_ORDER)[number]; label: string; avgDays: number | null; count: number }[];
  trend: { day: string; leads: number; demos: number; views: number }[];
  sources: { key: string; count: number }[];
  countries: { key: string; count: number }[];
  plans: { key: string; count: number }[];
  landingPages: { key: string; count: number }[];
  recentEvents: { at: string; summary: string; leadId?: string; type: string }[];
  demosToday: { id: string; leadId: string; startAt: string; status: string }[];
}

export const DAYS_MS = 86_400_000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function bucketBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string,
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export async function dashboardMetrics(
  target?: string,
  opts?: { from?: string; to?: string; ownerEmail?: string },
): Promise<DashboardMetrics> {
  const allLeads = await listLeads(target);
  const allDemos = await listDemos(target);
  const customers = await listConvertedCustomers(target);
  const data = await readData(target);
  const views = data.pageViews ?? [];

  // Optional date range: filter leads by createdAt within [from, to]
  const fromMs = opts?.from ? Date.parse(opts.from) : NaN;
  const toMs = opts?.to ? Date.parse(opts.to) : NaN;
  const hasRange = !Number.isNaN(fromMs) || !Number.isNaN(toMs);

  // Optional owner scope (sales reps see their own book of business)
  const owner = opts?.ownerEmail?.trim().toLowerCase();
  const mine = <T extends { ownerEmail?: string }>(rows: T[]): T[] =>
    owner ? rows.filter((r) => (r.ownerEmail ?? "").toLowerCase() === owner) : rows;
  const demoMine = <T extends { assignedTo?: string }>(rows: T[]): T[] =>
    owner ? rows.filter((r) => (r.assignedTo ?? "").toLowerCase() === owner) : rows;

  const demos = demoMine(allDemos);
  const rangeFiltered = hasRange
    ? allLeads.filter((l) => {
        const t = Date.parse(l.createdAt);
        if (!Number.isNaN(fromMs) && t < fromMs) return false;
        if (!Number.isNaN(toMs) && t > toMs) return false;
        return true;
      })
    : allLeads;
  const leads = mine(rangeFiltered);

  const now = new Date();
  const today0 = startOfToday(now).getTime();
  const sevenDaysAgo = now.getTime() - 7 * DAYS_MS;

  const newToday = leads.filter((l) => Date.parse(l.createdAt) >= today0);
  const new7d = leads.filter((l) => Date.parse(l.createdAt) >= sevenDaysAgo);
  const qualified = leads.filter((l) => l.stage !== "new" && l.stage !== "lost");
  const won = leads.filter((l) => l.stage === "won");
  const lost = leads.filter((l) => l.stage === "lost");
  const demosActive = demos.filter((d) => !["cancelled", "no_show"].includes(d.status));
  const trials = leads.filter((l) => Boolean(l.trialStartedAt) || l.stage === "trial");
  const conversions = won.length + customers.length;
  const followUpsDue = leads.filter((l) => {
    if (l.stage === "won" || l.stage === "lost") return false;
    if (!l.nextFollowUpAt) return false;
    return Date.parse(l.nextFollowUpAt) <= now.getTime() + DAYS_MS;
  });

  const byLanding = bucketBy(leads, (l) => l.attribution.pagePath ?? l.attribution.landing ?? "unknown");
  const bySource = bucketBy(leads, (l) => l.source);
  const byCountry = bucketBy(leads, (l) => l.country ?? "unknown");
  const byPlan = bucketBy(leads, (l) => l.planInterest ?? "none");

  const funnel = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: leads.filter((l) => l.stage === stage).length,
  }));

  // Trend window follows the selected range (default 14 days, capped at 90)
  const trendSpan = Math.min(
    Math.max(
      !Number.isNaN(fromMs) && !Number.isNaN(toMs)
        ? Math.round((toMs - fromMs) / DAYS_MS)
        : !Number.isNaN(fromMs)
          ? Math.round((now.getTime() - fromMs) / DAYS_MS)
          : 14,
      1,
    ),
    90,
  );
  const last14: { day: string; leads: number; demos: number; views: number }[] = [];
  const start14 = startOfToday(now);
  start14.setDate(start14.getDate() - (trendSpan - 1));
  for (let i = 0; i < trendSpan; i++) {
    const day = new Date(start14.getTime() + i * DAYS_MS);
    const key = dayKey(day);
    const lo = day.getTime();
    const hi = lo + DAYS_MS;
    last14.push({
      day: key.slice(5),
      leads: leads.filter((l) => {
        const t = Date.parse(l.createdAt);
        return t >= lo && t < hi;
      }).length,
      demos: demos.filter((d) => {
        const t = Date.parse(d.startAt);
        return t >= lo && t < hi;
      }).length,
      views: views.filter((v) => {
        const t = Date.parse(v.at);
        return t >= lo && t < hi;
      }).length,
    });
  }

  const demosToday = demos
    .filter((d) => {
      const t = Date.parse(d.startAt);
      return t >= today0 && t < today0 + DAYS_MS;
    })
    .map((d) => ({ id: d.id, leadId: d.leadId, startAt: d.startAt, status: d.status }));

  const closed = won.length + lost.length;
  const winRate = closed > 0 ? Math.round((won.length / closed) * 1000) / 10 : null;
  const avgDaysToWon =
    won.length > 0
      ? Math.round(
          (won.reduce((s, l) => s + (Date.parse(l.updatedAt ?? l.createdAt) - Date.parse(l.createdAt)), 0) /
            won.length /
            DAYS_MS) *
            10,
        ) / 10
      : null;

  const velocity = STAGE_ORDER.map((stage) => {
    const bucket = leads.filter((l) => l.stage === stage);
    if (!bucket.length) return { stage, label: STAGE_LABELS[stage], avgDays: null, count: 0 };
    const avgDays =
      Math.round(
        (bucket.reduce((s, l) => s + (now.getTime() - Date.parse(l.updatedAt ?? l.createdAt)), 0) / bucket.length / DAYS_MS) * 10,
      ) / 10;
    return { stage, label: STAGE_LABELS[stage], avgDays, count: bucket.length };
  });

  return {
    generatedAt: now.toISOString(),
    range: hasRange ? { from: opts?.from, to: opts?.to } : undefined,
    kpis: {
      newLeadsToday: newToday.length,
      newLeads7d: new7d.length,
      totalLeads: leads.length,
      qualified: qualified.length,
      demoRequests: demosActive.length,
      trials: trials.length,
      conversions,
      won: won.length,
      lost: lost.length,
      followUpsDue: followUpsDue.length,
      pipelineValue: totalPipelineValue(leads),
      winRate,
      avgDaysToWon,
      topLanding: byLanding[0] ?? null,
      topSource: bySource[0] ?? null,
      topCountry: byCountry[0] ?? null,
      topPlan: byPlan[0] ?? null,
    },
    funnel,
    velocity,
    trend: last14,
    sources: bySource,
    countries: byCountry,
    plans: byPlan,
    landingPages: byLanding,
    recentEvents: (data.leadEvents ?? [])
      .slice()
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 12)
      .map((e) => ({ at: e.at, summary: e.summary, leadId: e.leadId, type: e.type })),
    demosToday,
  };
}

export interface LeadsSummary extends DashboardMetrics {
  _unused?: never;
}

export async function topPages(views: readonly PageView[], limit = 5): Promise<{ key: string; count: number }[]> {
  return bucketBy(views, (v) => v.path.split("?")[0]).slice(0, limit);
}

export async function viewsByDay(views: readonly PageView[], days = 14): Promise<{ day: string; views: number }[]> {
  const out: { day: string; views: number }[] = [];
  const now = new Date();
  const start = startOfToday(now);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * DAYS_MS);
    const lo = day.getTime();
    const hi = lo + DAYS_MS;
    out.push({
      day: dayKey(day).slice(5),
      views: views.filter((v) => {
        const t = Date.parse(v.at);
        return t >= lo && t < hi;
      }).length,
    });
  }
  return out;
}

export async function allViews(target?: string): Promise<PageView[]> {
  const data = await readData(target);
  return data.pageViews ?? [];
}

export function leadValueLabel(v: number): string {
  return v <= 0 ? "—" : `$${v.toLocaleString("en-US")}`;
}