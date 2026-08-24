import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listLeads, filterLeads } from "@/lib/marketing/leads";
import { listUsers } from "@/lib/marketing/users";
import { isLeadStage } from "@/lib/marketing/stages";
import LeadsTableClient from "@/components/marketing-admin/LeadsTableClient";
import { FilterChipLink, SearchBox, SelectFilter } from "@/components/marketing-admin/LeadTable";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/marketing/stages";

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
  const allLeadsCount = leads.length;
  // "?owner=__none__" means "unassigned" — filterLeads can't express that, so
  // pre-reduce here.
  const unassignOnly = owner === "__none__";
  let filtered = filterLeads(
    unassignOnly ? leads.filter((l) => !l.ownerEmail) : leads,
    {
    q,
    stage: stage as never,
    source: source as never,
    country: country || undefined,
    plan: plan || undefined,
    band: band as never,
    owner: unassignOnly ? undefined : owner || undefined,
  });

  // Sorting
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

  const rows = paged.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    company: l.company,
    propertyName: l.propertyName,
    country: l.country,
    planInterest: l.planInterest,
    source: l.source,
    stage: l.stage,
    score: l.score,
    band: l.band,
    ownerEmail: l.ownerEmail,
    nextFollowUpAt: l.nextFollowUpAt,
    estimatedValue: l.estimatedValue,
    estimatedValueCurrency: l.estimatedValueCurrency,
    rooms: l.rooms,
    createdAt: l.createdAt,
  }));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const merged = { stage, source, country, plan, band, owner, sort, dir, page: String(safePage), perPage: String(perPage), ...patch };
    for (const [k, v] of Object.entries(merged)) {
      const def = k === "perPage" ? "20" : k === "sort" ? "updatedAt" : k === "dir" ? "desc" : k === "page" ? "1" : "all";
      if (!v || v === def || (k === "page" && v === "1")) {
        if (k === "perPage" && v === "20") continue;
        if (k === "sort" && v === "updatedAt") continue;
        if (k === "dir" && v === "desc") continue;
        if (k === "page" && v === "1") continue;
        if (v === "all" || v === "") continue;
      }
      p.set(k, v);
    }
    // When filter changes, reset page
    if (patch.stage !== undefined || patch.source !== undefined || patch.country !== undefined || patch.q !== undefined || patch.band !== undefined || patch.owner !== undefined) {
      p.delete("page");
    }
    return p.toString() ? `/marketing-admin/leads?${p}` : "/marketing-admin/leads";
  };

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

  const ALL_SOURCES = [
    "organic", "google_ads", "meta_ads", "linkedin", "youtube", "direct",
    "referral", "partner", "email", "whatsapp", "blog", "pricing_page",
    "feature_page", "demo_page", "country_page", "campaign", "other",
  ];
  /** Sources that actually have leads — shown as chips; the rest stay in the dropdown. */
  const activeSources = ALL_SOURCES.filter((s) => leads.some((l) => l.source === s));
  const countryOptions = Array.from(new Set(leads.map((l) => l.country).filter(Boolean) as string[])).sort();
  const planOptions = Array.from(new Set(leads.map((l) => l.planInterest).filter(Boolean) as string[])).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} of {allLeadsCount} leads · page {safePage} of {totalPages} · every form and demo request is captured automatically.
          </p>
        </div>
      </div>

      <LeadsTableClient
        rows={rows}
        total={total}
        page={safePage}
        perPage={perPage}
        totalPages={totalPages}
        sort={sort}
        dir={dir}
        ownerOptions={ownerOptions}
        exportHref={exportHref}
        filterBar={
          <>
            <SearchBox initial={q} />
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              <FilterChipLink href={href({ stage: "all" })} label="All stages" active={stage === "all"} />
              {PIPELINE_STAGES.map((s) => (
                <FilterChipLink key={s} href={href({ stage: s })} label={STAGE_LABELS[s]} active={stage === s} />
              ))}
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              <FilterChipLink href={href({ source: "all" })} label="All sources" active={source === "all"} />
              {(activeSources.length > 0 ? activeSources : ALL_SOURCES).map((s) => (
                <FilterChipLink key={s} href={href({ source: s })} label={s.replace(/_/g, " ")} active={source === s} />
              ))}
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              <FilterChipLink href={href({ band: "all" })} label="All bands" active={band === "all"} />
              {["cold", "warm", "hot", "very_hot"].map((b) => (
                <FilterChipLink key={b} href={href({ band: b })} label={b.replace("_", " ")} active={band === b} />
              ))}
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-3">
              <SelectFilter
                param="owner"
                value={owner}
                label="Owner"
                allLabel="Any owner"
                options={[
                  { value: "__none__", label: "— Unassigned —" },
                  ...ownerOptions.map((o) => ({ value: o.email, label: o.name || o.email })),
                ]}
              />
              <SelectFilter
                param="country"
                value={country}
                label="Country"
                options={countryOptions.map((c) => ({ value: c, label: c }))}
              />
              <SelectFilter
                param="plan"
                value={plan}
                label="Plan"
                options={planOptions.map((p) => ({ value: p, label: p }))}
              />
            </div>
          </>
        }
      />
    </div>
  );
}