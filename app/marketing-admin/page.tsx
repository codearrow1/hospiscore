import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { dashboardMetrics, leadValueLabel } from "@/lib/marketing/metrics";
import { campaignStats } from "@/lib/marketing/campaigns";
import { listDemos } from "@/lib/marketing/demos";
import { listLeads } from "@/lib/marketing/leads";
import { Bars, Donut, Line } from "@/components/marketing-admin/charts";
import { Badge, EmptyState, KpiCard, SectionCard } from "@/components/marketing-admin/ui";
import DashboardFilters from "@/components/marketing-admin/DashboardFilters";
import { STAGE_STYLES } from "@/lib/marketing/stages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) {
    return restrictedPanel(
      "Marketing Command Center",
      "This area is restricted to the HospiOS marketing and sales team.",
    );
  }
  await ensureMarketingStore();

  const sp = (await searchParams) ?? {};
  const from = sp.from?.trim() || undefined;
  const to = sp.to?.trim() || undefined;

  const [m, campaigns, leads, demos] = await Promise.all([
    dashboardMetrics(undefined, { from, to }),
    campaignStats(),
    listLeads(),
    listDemos(),
  ]);

  const followUps = leads
    .filter((l) => {
      if (!l.nextFollowUpAt) return false;
      const t = Date.parse(l.nextFollowUpAt);
      return t >= Date.now() - 86_400_000 && t <= Date.now() + 86_400_000;
    })
    .sort((a, b) => Date.parse(a.nextFollowUpAt!) - Date.parse(b.nextFollowUpAt!))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Live numbers from the website pipeline — no fabricated metrics.
          {m.range?.from || m.range?.to ? (
            <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">
              · {m.range.from ?? "…"} → {m.range.to ?? "…"}
            </span>
          ) : null}
        </p>
      </div>

      <DashboardFilters initialFrom={from} initialTo={to} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="New leads today" value={m.kpis.newLeadsToday} hint={`${m.kpis.newLeads7d} in 7 days`} href="/marketing-admin/leads" />
        <KpiCard label="Total leads" value={m.kpis.totalLeads} accent="text-indigo-600 dark:text-indigo-400" href="/marketing-admin/leads" />
        <KpiCard label="Qualified" value={m.kpis.qualified} href="/marketing-admin/leads?stage=qualified" />
        <KpiCard label="Demo requests" value={m.kpis.demoRequests} href="/marketing-admin/demos" />
        <KpiCard label="Trials" value={m.kpis.trials} href="/marketing-admin/leads?stage=trial" />
        <KpiCard label="Converted" value={m.kpis.conversions} accent="text-emerald-600 dark:text-emerald-400" href="/marketing-admin/leads?stage=won" />
        <KpiCard label="Follow-ups due" value={m.kpis.followUpsDue} accent={m.kpis.followUpsDue > 0 ? "text-amber-600 dark:text-amber-400" : undefined} href="/marketing-admin/leads" />
        <KpiCard
          label="Pipeline value"
          value={leadValueLabel(m.kpis.pipelineValue)}
          hint={`${m.kpis.won} won · ${m.kpis.lost} lost`}
          accent="text-emerald-600 dark:text-emerald-400"
          href="/marketing-admin/pipeline"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Win rate"
          value={m.kpis.winRate == null ? "—" : `${m.kpis.winRate}%`}
          hint={`${m.kpis.won} / ${m.kpis.won + m.kpis.lost} closed`}
          href="/marketing-admin/leads?stage=won"
        />
        <KpiCard
          label="Avg days to won"
          value={m.kpis.avgDaysToWon == null ? "—" : `${m.kpis.avgDaysToWon}d`}
          hint="Created → won"
        />
        <div className="col-span-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Velocity (avg days in stage)</p>
          <ul className="mt-2 space-y-1 text-xs">
            {m.velocity
              .filter((v) => v.count > 0)
              .slice(0, 6)
              .map((v) => (
                <li key={v.stage} className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{v.label}</span>
                  <span className="font-semibold tabular-nums">{v.avgDays == null ? "—" : `${v.avgDays}d`} <span className="font-normal text-zinc-400">· {v.count}</span></span>
                </li>
              ))}
            {m.velocity.filter((v) => v.count > 0).length === 0 && (
              <li className="text-zinc-400">No staged leads yet</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Funnel" className="lg:col-span-1">
          <div className="space-y-1.5">
            {m.funnel.map((f, i) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">{f.label}</span>
                  <span className="font-bold tabular-nums">{f.count}</span>
                </div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${m.funnel[0].count ? (f.count / m.funnel[0].count) * 100 : 0}%` }}
                  />
                </div>
                {i < m.funnel.length - 1 && <div className="pt-0.5 text-center text-[9px] text-zinc-400">↓</div>}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="14-day trend" className="lg:col-span-2">
          <Line data={m.trend} height={150} />
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Leads</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Demos</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Page views</span>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Top landing page">
          {m.kpis.topLanding ? (
            <div>
              <p className="truncate font-mono text-sm text-indigo-600 dark:text-indigo-400">{m.kpis.topLanding.key}</p>
              <p className="mt-1 text-2xl font-bold">{m.kpis.topLanding.count} <span className="text-sm font-normal text-zinc-400">leads</span></p>
            </div>
          ) : (
            <EmptyState title="No leading page yet" />
          )}
        </SectionCard>
        <SectionCard title="Top source">
          {m.kpis.topSource ? (
            <div>
              <p className="text-sm font-semibold capitalize">{m.kpis.topSource.key.replace(/_/g, " ")}</p>
              <p className="mt-1 text-2xl font-bold">{m.kpis.topSource.count} <span className="text-sm font-normal text-zinc-400">leads</span></p>
            </div>
          ) : (
            <EmptyState title="No source yet" />
          )}
        </SectionCard>
        <SectionCard title="Top country">
          {m.kpis.topCountry ? (
            <div>
              <p className="text-sm font-semibold">{m.kpis.topCountry.key}</p>
              <p className="mt-1 text-2xl font-bold">{m.kpis.topCountry.count} <span className="text-sm font-normal text-zinc-400">leads</span></p>
            </div>
          ) : (
            <EmptyState title="No country yet" />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Lead sources">
          {m.sources.length ? <Donut data={m.sources} centerLabel="leads" /> : <EmptyState title="No leads yet" />}
        </SectionCard>
        <SectionCard title="Plan interest">
          {m.plans.length ? <Bars data={m.plans} labelKey="Plan interest" /> : <EmptyState title="No plan interest captured" />}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Follow-ups due (next 24h)"
          action={followUps.length ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{followUps.length}</Badge> : undefined}
        >
          {followUps.length === 0 ? (
            <EmptyState title="Nothing due right now" />
          ) : (
            <ul className="space-y-2">
              {followUps.map((l) => (
                <li key={l.id}>
                  <Link href={`/marketing-admin/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 transition hover:border-indigo-400 dark:border-zinc-800">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{l.name}</span>
                      <span className="block truncate text-xs text-zinc-400">{l.company || l.propertyName || l.email}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-semibold text-amber-600 dark:text-amber-400">{fmtDate(l.nextFollowUpAt!)}</span>
                      <Badge className={STAGE_STYLES[l.stage]}>{l.stage}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recent activity">
          {m.recentEvents.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-2">
              {m.recentEvents.map((e) => (
                <li key={e.leadId + e.at} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span className="min-w-0">
                    <span className="block text-zinc-700 dark:text-zinc-200">{e.summary}</span>
                    <span className="block text-xs text-zinc-400">{fmtDate(e.at)}</span>
                  </span>
                  {e.leadId && (
                    <Link href={`/marketing-admin/leads/${e.leadId}`} className="ml-auto shrink-0 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                      View
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Demos today" action={demos.length ? <Badge>{demos.length}</Badge> : undefined}>
        {m.demosToday.length === 0 ? (
          <EmptyState title="No demos scheduled today" body="Book one from the Demos page." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {m.demosToday.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <span className="font-semibold">{new Date(d.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                <Badge className={STAGE_STYLES[d.status === "converted" || d.status === "completed" ? "won" : d.status === "cancelled" || d.status === "no_show" ? "lost" : "demo_booked"]}>{d.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Campaigns"
        action={
          <Link href="/marketing-admin/campaigns" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            Manage →
          </Link>
        }
      >
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" body="Create your first campaign to start tracking attribution." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="pb-2 pr-3 font-semibold">Campaign</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Leads</th>
                  <th className="pb-2 pr-3 font-semibold">Demos</th>
                  <th className="pb-2 pr-3 font-semibold">Trials</th>
                  <th className="pb-2 font-semibold">Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3"><Badge>{c.status}</Badge></td>
                    <td className="py-2 pr-3 tabular-nums">{c.leads}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.demos}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.trials}</td>
                    <td className="py-2 tabular-nums">{leadValueLabel(c.pipelineValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}