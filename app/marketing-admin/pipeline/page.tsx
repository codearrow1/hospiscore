import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listLeads, filterLeads } from "@/lib/marketing/leads";
import { listUsers } from "@/lib/marketing/users";
import { isLeadStage } from "@/lib/marketing/stages";
import type { LeadStage } from "@/lib/marketing/types";
import PipelineBoard from "@/components/marketing-admin/PipelineBoard";
import type { PipelineLead } from "@/components/marketing-admin/PipelineBoard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) {
    return restrictedPanel("Pipeline", "You need leads.read permission to view the sales pipeline.");
  }
  await ensureMarketingStore();

  const sp = await searchParams;
  const q = sp.q ?? "";
  const owner = sp.owner ?? "";
  const stage = isLeadStage(sp.stage ?? "") ? (sp.stage as LeadStage) : undefined;

  const [leads, users] = await Promise.all([listLeads(), listUsers()]);
  // Unassigned filter uses the same sentinel as the leads table.
  const unassignOnly = owner === "__none__";
  const scoped = filterLeads(
    unassignOnly ? leads.filter((l) => !l.ownerEmail) : leads,
    {
      q: q || undefined,
      owner: unassignOnly ? undefined : owner || undefined,
      stage: stage ?? "all",
    },
  );

  const rows: PipelineLead[] = scoped
    .filter((l) => !l.convertedCustomerId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      ownerEmail: l.ownerEmail,
      estimatedValue: l.estimatedValue,
      estimatedValueCurrency: (l as { estimatedValueCurrency?: string }).estimatedValueCurrency,
      stage: l.stage,
      nextFollowUpAt: l.nextFollowUpAt,
    }));

  /** Pipeline value grouped by record currency — mixed books are never merged. */
  const valueByCurrency: Record<string, number> = {};
  for (const r of rows) {
    const cur = r.estimatedValueCurrency ?? "USD";
    valueByCurrency[cur] = (valueByCurrency[cur] ?? 0) + r.estimatedValue;
  }
  const currencyEntries = Object.entries(valueByCurrency).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  const ownerOptions = users.map((u) => ({ email: u.email, name: u.name }));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q && patch.q === undefined) p.set("q", q);
    if (owner && patch.owner === undefined) p.set("owner", owner);
    if (stage && patch.stage === undefined) p.set("stage", stage);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || k === "stage" && v === stage) continue;
      p.set(k, v);
      if ((k === "q" || k === "owner" || k === "stage") && !v) p.delete(k);
    }
    return p.toString() ? `/marketing-admin/pipeline?${p}` : "/marketing-admin/pipeline";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {rows.length} open deal{rows.length === 1 ? "" : "s"}
          {currencyEntries.length > 0 && (
            <> · {currencyEntries.map(([cur, v], i) => (
              <span key={cur}>
                {i > 0 && " + "}
                  <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v / 100)} {cur}
                  </span>
              </span>
            ))} estimated</>
          )}
          {" "}— use the select on a card to advance or re-open a deal.
        </p>
      </div>

      <PipelineBoard
        leads={rows}
        filterBar={
          <>
            {/* GET-form search — works without JS and stays URL-synced. */}
            <form method="get" action="/marketing-admin/pipeline" className="flex min-w-0 flex-1 gap-2 md:max-w-xs">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, email…"
                aria-label="Search pipeline"
                className="min-h-9 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900"
              />
              {owner && <input type="hidden" name="owner" value={owner} />}
              <button type="submit" className="inline-flex min-h-9 items-center rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-surface-subtle">
                Search
              </button>
            </form>
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              <a href={qs({ owner: "" })} className={`inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${!owner ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}>
                Any owner
              </a>
              <a href={qs({ owner: "__none__" })} className={`inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${unassignOnly ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}>
                Unassigned
              </a>
              {ownerOptions.map((o) => (
                <a key={o.email} href={qs({ owner: o.email })} className={`inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${owner === o.email ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}>
                  {o.name || o.email}
                </a>
              ))}
            </div>
          </>
        }
      />
    </div>
  );
}
