import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import {
  dashboardMetrics,
  allViews,
  viewsByDay,
  topPages,
  leadValueLabel,
} from "@/lib/marketing/metrics";
import { Line, Bars } from "@/components/marketing-admin/charts";
import { KpiCard, SectionCard, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnalyticsPage() {
  const guard = await requireCapability("analytics.read");
  if (!guard.ok) {
    return restrictedPanel("Analytics", "You need analytics.read permission to view analytics.");
  }
  await ensureMarketingStore();

  const [m, views] = await Promise.all([dashboardMetrics(), allViews()]);
  const trend = await viewsByDay(views, 14);
  const pages = await topPages(views, 10);

  const sessions = new Set(views.map((v) => v.session)).size;
  const referrers = new Map<string, number>();
  const viewCountries = new Map<string, number>();
  const utmSources = new Map<string, number>();
  const utmCampaigns = new Map<string, number>();
  for (const v of views) {
    if (v.referrer) {
      let host = v.referrer.replace(/^https?:\/\//, "").split("/")[0] ?? v.referrer;
      if (host.startsWith("www.")) host = host.slice(4);
      referrers.set(host, (referrers.get(host) ?? 0) + 1);
    }
    if (v.country) viewCountries.set(v.country, (viewCountries.get(v.country) ?? 0) + 1);
    const src = v.utmSource ?? (v.referrer ? referrerName(v.referrer) : "direct");
    utmSources.set(src, (utmSources.get(src) ?? 0) + 1);
    if (v.utmCampaign) utmCampaigns.set(v.utmCampaign, (utmCampaigns.get(v.utmCampaign) ?? 0) + 1);
  }

  const conversionRate =
    views.length > 0 ? Math.round((m.kpis.totalLeads / views.length) * 1000) / 10 : 0;

  const topReferrers = Array.from(referrers.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topViewCountries = Array.from(viewCountries.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topUtmSources = Array.from(utmSources.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topUtmCampaigns = Array.from(utmCampaigns.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Traffic and conversion from the privacy-light site beacon — no cookies,
          no stored IPs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Page views" value={views.length.toLocaleString()} />
        <KpiCard label="Sessions" value={sessions.toLocaleString()} />
        <KpiCard label="Leads captured" value={m.kpis.totalLeads} accent="text-indigo-600 dark:text-indigo-400" />
        <KpiCard label="Conversion rate" value={`${conversionRate}%`} />
        <KpiCard label="Demos" value={m.kpis.demoRequests} />
        <KpiCard label="Pipeline value" value={leadValueLabel(m.kpis.pipelineValue)} accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      <SectionCard title="Views, last 14 days">
        <Line
          data={trend.map((t) => ({ day: t.day, leads: 0, demos: 0, views: t.views }))}
          height={160}
        />
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

        <SectionCard title="Top referrers">
          {topReferrers.length === 0 ? (
            <EmptyState title="No referrers yet" />
          ) : (
            <div className="space-y-2">
              {topReferrers.map(([host, count]) => (
                <div key={host} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{host}</span>
                  <span className="tabular-nums font-semibold">{count}</span>
                </div>
              ))}
            </div>
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