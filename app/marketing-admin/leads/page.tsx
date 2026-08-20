import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listLeads, filterLeads } from "@/lib/marketing/leads";
import { isLeadStage } from "@/lib/marketing/stages";
import LeadsTableClient from "@/components/marketing-admin/LeadsTableClient";
import { FilterChipLink, SearchBox } from "@/components/marketing-admin/LeadTable";
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

  const leads = await listLeads();
  const rows = filterLeads(leads, {
    q,
    stage: stage as never,
    source: source as never,
    country: country || undefined,
    plan: plan || undefined,
    band: band as never,
  }).map((l) => ({
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
    rooms: l.rooms,
    createdAt: l.createdAt,
  }));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const merged = { stage, source, country, plan, band, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") p.set(k, v);
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
  }).toString()}`;

  const sourceOptions = [
    "organic", "google_ads", "meta_ads", "linkedin", "youtube", "direct",
    "referral", "partner", "email", "whatsapp", "blog", "pricing_page",
    "feature_page", "demo_page", "country_page", "campaign",
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {rows.length} of {leads.length} leads · every form and demo request is captured automatically.
          </p>
        </div>
      </div>

      <LeadsTableClient
        rows={rows}
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
              {sourceOptions.slice(0, 8).map((s) => (
                <FilterChipLink key={s} href={href({ source: s })} label={s.replace(/_/g, " ")} active={source === s} />
              ))}
            </div>
          </>
        }
      />
    </div>
  );
}