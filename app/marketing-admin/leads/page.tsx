import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { hasCapability } from "@/lib/marketing/roles";
import { listLeads, filterLeads, listConvertedCustomers } from "@/lib/marketing/leads";
import { listDemos } from "@/lib/marketing/demos";
import { listUsers } from "@/lib/marketing/users";
import { isLeadStage, PIPELINE_STAGES, STAGE_LABELS } from "@/lib/marketing/stages";
import { LEAD_SOURCES } from "@/lib/marketing/types";
import {
  buildLeadRows,
  leadsKpis,
  funnelOf,
  openValueByCurrency,
  type LeadRow,
} from "@/lib/marketing/leadsView";
import LeadsTableClient from "@/components/marketing-admin/LeadsTableClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) {
    return restrictedPanel("Leads", "You need leads.read permission to manage the lead list.");
  }
  await ensureMarketingStore();

  const sp = await searchParams;
  const q = sp.q ?? "";
  const stage = (isLeadStage(sp.stage ?? "") ? sp.stage : "all") as "all" | (typeof PIPELINE_STAGES)[number];
  const source = (sp.source ?? "all") as string;
  const country = sp.country ?? "";
  const plan = sp.plan ?? "";
  const band = (sp.band ?? "all") as string;
  const owner = sp.owner ?? "";
  const sort = (sp.sort ?? "updatedAt") as "updatedAt" | "createdAt" | "score" | "name" | "stage";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const perPageRaw = parseInt(sp.perPage ?? "20", 10) || 20;
  const perPage = [10, 20, 50].includes(perPageRaw) ? perPageRaw : 20;

  const [leads, users] = await Promise.all([listLeads(), listUsers()]);
  const demos = await listDemos();
  const converted = await listConvertedCustomers();

  // Sales reps (no leads.manage) are hard-scoped to their own assignments,
  // mirroring GET /api/marketing/leads and the pipeline board — the page can
  // never leak other people's leads, and an ?owner= param cannot widen it.
  const canManage = hasCapability(guard.user, "leads.manage");
  const scopedLeads = canManage
    ? leads
    : leads.filter((l) => (l.ownerEmail ?? "").toLowerCase() === guard.user.email.toLowerCase());

  const allLeadsCount = scopedLeads.length;

  // "?owner=__none__" means "unassigned" — filterLeads can't express that, so
  // pre-reduce here.
  const unassignOnly = owner === "__none__";
  let filtered = filterLeads(
    unassignOnly ? scopedLeads.filter((l) => !l.ownerEmail) : scopedLeads,
    {
      q,
      stage: stage as never,
      source: source as never,
      country: country || undefined,
      plan: plan || undefined,
      band: band as never,
      owner: unassignOnly ? undefined : owner || undefined,
    },
  );

  // Sorting (server-side, URL driven)
  filtered = filtered.slice().sort((a, b) => {
    let cmp = 0;
    if (sort === "score") cmp = a.score - b.score;
    else if (sort === "name") cmp = a.name.localeCompare(b.name);
    else if (sort === "stage") cmp = PIPELINE_STAGES.indexOf(a.stage) - PIPELINE_STAGES.indexOf(b.stage);
    else if (sort === "createdAt") cmp = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    else cmp = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    return dir === "asc" ? cmp : -cmp;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // Enrich *all* filtered rows (not just the page) so KPIs/summaries reflect
  // the current filtered view, then page the enriched rows for the table.
  const allRows = buildLeadRows(filtered, demos, converted);
  const rowById = new Map(allRows.map((r) => [r.id, r]));
  const pagedRows = paged.map((l) => rowById.get(l.id) as LeadRow);
  const kpis = leadsKpis(allRows);
  const funnel = funnelOf(allRows, PIPELINE_STAGES);
  const openValue = openValueByCurrency(allRows);

  const exportHref = `/api/marketing/export?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(stage !== "all" ? { stage } : {}),
    ...(source !== "all" ? { source } : {}),
    ...(country ? { country } : {}),
    ...(plan ? { plan } : {}),
    ...(band !== "all" ? { band } : {}),
    ...(owner ? { owner } : {}),
  }).toString()}`;

  const ownerOptions = users.map((u) => ({ email: u.email, name: u.name }));
  const activeSources = LEAD_SOURCES.filter((s) => scopedLeads.some((l) => l.source === s));
  const countryOptions = Array.from(new Set(scopedLeads.map((l) => l.country).filter(Boolean) as string[])).sort();
  const planOptions = Array.from(new Set(scopedLeads.map((l) => l.planInterest).filter(Boolean) as string[])).sort();
  const bandOptions = ["cold", "warm", "hot", "very_hot"];
  const stageOptions = PIPELINE_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));

  return (
    <LeadsTableClient
      rows={pagedRows}
      allRowsCount={allLeadsCount}
      total={total}
      page={safePage}
      perPage={perPage}
      totalPages={totalPages}
      sort={sort}
      dir={dir}
      ownerOptions={ownerOptions}
      sourceOptions={activeSources}
      countryOptions={countryOptions}
      planOptions={planOptions}
      bandOptions={bandOptions}
      stageOptions={stageOptions}
      exportHref={exportHref}
      currentFilters={{
        q, stage, source, country, plan, band, owner,
      }}
      kpis={kpis}
      funnel={funnel}
      openValue={openValue}
    />
  );
}
