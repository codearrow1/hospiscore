import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import {
  dashboardMetrics,
  allViews,
  topPages,
  leadValueLabel,
} from "@/lib/marketing/metrics";
import { Line, Bars, Donut } from "@/components/marketing-admin/charts";
import { KpiCard, SectionCard, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RANGES = [7, 14, 30, 90] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireCapability("analytics.read");
  if (!guard.ok) {
    return restrictedPanel("Analytics", "You need analytics.read permission to view analytics.");
  }
  await ensureMarketingStore();

  const sp = await searchParams;
  const parsed = parseInt(sp.range ?? "14", 10);
  const range = (RANGES as readonly number[]).includes(parsed) ? parsed : 14;
  const from = new Date(Date.now() - range * 86_400_000).toISOString();

  /** One shared date range drives every section on the page. */
  const [m, viewsAll] = await Promise.all([dashboardMetrics(undefined, { from }), allViews()]);
  const views = viewsAll.filter((v) => Date.parse(v.at) >= Date.parse(from));

  // Real per-day leads/demos/views series straight from the CRM store
  // (dashboardMetrics already windows it to the selected range).
  const trendSeries = m.trend;
  const pages = await topPages(views, 10);

  const sessions = new Set(views.map((v) => v.session)).size;
  const viewCountries = new Map<string, number>();
  const utmSources = new Map<string, number>();
  const utmCampaigns = new Map<string, number>();
  for (const v of views) {
    if (v.country) viewCountries.set(v.country, (viewCountries.get(v.country) ?? 0) + 1);
    const src = v.utmSource ?? (v.referrer ? referrerName(v.referrer) : "direct");
    utmSources.set(src, (utmSources.get(src) ?? 0) + 1);
    if (v.utmCampaign) utmCampaigns.set(v.utmCampaign, (utmCampaigns.get(v.utmCampaign) ?? 0) + 1);
  }

  const conversionRate =
    views.length > 0 ? Math.round((m.kpis.totalLeads / views.length) * 1000) / 10 : 0;

  const topViewCountries = Array.from(viewCountries.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topUtmSources = Array.from(utmSources.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topUtmCampaigns = Array.from(utmCampaigns.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const funnelData = m.funnel
    .filter((f) => f.count > 0)
    .map((f) => ({ key: `${f.label} (${f.count})`, count: f.count }));
  const sourceData = m.sources.slice(0, 8).map((s) => ({ key: s.key.replace(/_/g, " "), count: s.count }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Traffic and conversion from the privacy-light site beacon — no cookies,
            no stored IPs.
          </p>
        </div>
        {/* Shared date range — every KPI and chart below follows it. */}
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {RANGES.map((r) => (
            <a
              key={r}
              href={r === 14 ? "/marketing-admin/analytics" : `/marketing-admin/analytics?range=${r}`}
              aria-current={r === range}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                r === range
                  ? "bg-white shadow-sm dark:bg-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {r}d
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label={`Page views (${range}d)`} value={new Intl.NumberFormat("en-US").format(views.length)} />
        <KpiCard label="Sessions" value={new Intl.NumberFormat("en-US").format(sessions)} />
        <KpiCard label="Leads captured" value={m.kpis.totalLeads} accent="text-indigo-600 dark:text-indigo-400" />
        <KpiCard label="Conversion rate" value={`${conversionRate}%`} />
        <KpiCard label="Demos" value={m.kpis.demoRequests} />
        <KpiCard label="Pipeline value" value={leadValueLabel(m.kpis.pipelineValue)} accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      <SectionCard title={`Daily traffic & pipeline — last ${range} days`}>
        {views.length === 0 && m.kpis.totalLeads === 0 ? (
          <EmptyState
            title="No traffic in this window"
            body="Public pages emit a beacon — once visits or leads arrive, daily lines appear here."
          />
        ) : (
          <>
            <Line data={trendSeries} height={180} />
            <p className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#94a3b8]" /> Views</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6366f1]" /> Leads</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22d3ee]" /> Demos booked</span>
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard title={`Pipeline funnel — ${range}-day cohort`}>
        {funnelData.length === 0 ? (
          <EmptyState title="No leads in this window yet" body="New submissions will build the funnel automatically." />
        ) : (
          <Bars data={funnelData} labelKey="leads by stage" height={140} barClass="fill-indigo-500" />
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Top pages by views">
          {pages.length === 0 ? (
            <EmptyState title="No tracked views yet" body="Public pages emit a beacon — install the script to start collecting." />
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {pages.map((p, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">{p.key}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Lead sources">
          {sourceData.length === 0 ? (
            <EmptyState title="No leads captured yet" />
          ) : (
            <Donut data={sourceData} centerLabel="leads" centerValue={m.kpis.totalLeads} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Views by country">
          {topViewCountries.length === 0 ? (
            <EmptyState title="No geo data yet" />
          ) : (
            <Bars data={topViewCountries.map(([key, count]) => ({ key, count }))} labelKey="views" />
          )}
        </SectionCard>
        <SectionCard title="Acquisition (UTM + referrer)">
          {topUtmSources.length === 0 ? (
            <EmptyState title="No acquisition data yet" />
          ) : (
            <Bars data={topUtmSources.map(([key, count]) => ({ key, count }))} labelKey="views" />
          )}
        </SectionCard>
        <SectionCard title="Campaign-driven views">
          {topUtmCampaigns.length === 0 ? (
            <EmptyState title="No UTM campaigns seen yet" body="Append ?utm_campaign=… to your links." />
          ) : (
            <Bars data={topUtmCampaigns.map(([key, count]) => ({ key, count }))} labelKey="views" />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function referrerName(referrer: string): string {
  const host = referrer.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return host.startsWith("www.") ? host.slice(4) : host;
}
