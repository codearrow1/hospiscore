/**
 * Client-safe URL builders for the Growth workspace pages.
 *
 * These MUST be assembled on the client: passing a function prop from a Server
 * Component into a Client Component is not serializable across the React Server
 * Components boundary and fails hydration with an RSC render error in
 * production. The pages render the navigation state; the client components
 * build their own href strings from it.
 */

export interface LeadsFiltersForHref {
  q: string;
  stage: string;
  source: string;
  country: string;
  plan: string;
  band: string;
  owner: string;
}

export interface LeadsHrefCtx {
  sort: string;
  dir: string;
  page: number;
  perPage: number;
}

export function buildLeadsHref(
  filters: LeadsFiltersForHref,
  ctx: LeadsHrefCtx,
  patch: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | undefined> = {
    stage: filters.stage,
    source: filters.source,
    country: filters.country,
    plan: filters.plan,
    band: filters.band,
    owner: filters.owner,
    sort: ctx.sort,
    dir: ctx.dir,
    page: String(ctx.page),
    perPage: String(ctx.perPage),
    q: filters.q,
    ...patch,
  };
  const p = new URLSearchParams();
  const defaults: Record<string, string> = {
    stage: "all",
    source: "all",
    band: "all",
    owner: "",
    country: "",
    plan: "",
    sort: "updatedAt",
    dir: "desc",
    page: "1",
    perPage: "20",
    q: "",
  };
  for (const [k, v] of Object.entries(merged)) {
    if (!v) continue;
    if (v === defaults[k]) continue;
    p.set(k, v);
  }
  const filterKeys = ["stage", "source", "country", "plan", "band", "owner", "q"];
  if (filterKeys.some((k) => k in patch)) p.delete("page");
  return p.toString() ? `/marketing-admin/leads?${p}` : "/marketing-admin/leads";
}

export interface DemosFiltersForHref {
  q: string;
  status: string;
  owner: string;
  period: string;
  country: string;
  stage: string;
  source: string;
  demoType: string;
  followUp: string;
}

export interface DemosHrefCtx {
  view: string;
  week?: string;
  sort: string;
  dir: string;
  page: number;
  perPage: number;
}

export function buildDemosHref(
  filters: DemosFiltersForHref,
  ctx: DemosHrefCtx,
  patch: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | undefined> = {
    view: ctx.view,
    ...(ctx.week ? { week: ctx.week } : {}),
    q: filters.q,
    status: filters.status,
    owner: filters.owner,
    period: filters.period,
    country: filters.country,
    stage: filters.stage,
    source: filters.source,
    demoType: filters.demoType,
    followUp: filters.followUp,
    sort: ctx.sort,
    dir: ctx.dir,
    page: String(ctx.page),
    perPage: String(ctx.perPage),
    ...patch,
  };
  const p = new URLSearchParams();
  const defaults: Record<string, string> = {
    view: "week",
    q: "",
    status: "",
    owner: "",
    period: "",
    country: "",
    stage: "",
    source: "",
    demoType: "",
    followUp: "",
    sort: "startAt",
    dir: "asc",
    page: "1",
    perPage: "20",
  };
  for (const [k, v] of Object.entries(merged)) {
    if (!v || v === defaults[k]) continue;
    p.set(k, v);
  }
  const filterKeys = ["q", "status", "owner", "period", "country", "stage", "source", "demoType", "followUp"];
  if (filterKeys.some((k) => k in patch)) p.delete("page");
  return p.toString() ? `/marketing-admin/demos?${p}` : "/marketing-admin/demos";
}