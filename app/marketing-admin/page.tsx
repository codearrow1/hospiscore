import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { dashboardMetrics, leadValueLabel } from "@/lib/marketing/metrics";
import { campaignStats } from "@/lib/marketing/campaigns";
import { listDemos } from "@/lib/marketing/demos";
import { listLeads } from "@/lib/marketing/leads";
import { hasCapability, roleFor, ROLE_LABELS, type Capability } from "@/lib/marketing/roles";
import { Donut } from "@/components/marketing-admin/charts";
import { Badge, EmptyState, SectionCard } from "@/components/ui";
import { KpiTile } from "@/components/dashboards/KpiTile";
import { ExceptionRail, type ExceptionItem } from "@/components/dashboards/ExceptionRail";
import { RangeTabs, rangeToFrom } from "@/components/dashboards/RangeTabs";
import { MultiLine, BarChart } from "@/components/dashboards/charts-interactive";
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
  const user = guard.user;
  await ensureMarketingStore();

  const sp = (await searchParams) ?? {};
  const range = ["7", "30", "90"].includes(sp.range ?? "") ? (sp.range as string) : undefined;
  const from = range ? rangeToFrom(range) : (sp.from?.trim() || undefined);
  const to = range ? undefined : (sp.to?.trim() || undefined);

  // Role matrix → what this user sees
  const role = roleFor(user);
  const cap = (c: Capability) => hasCapability(user, c);
  const canLeads = cap("leads.read");
  const manageLeads = cap("leads.manage");
  const canCampaigns = cap("campaigns.manage");
  const canAnalytics = cap("analytics.read");
  // Sales reps see their own book of business
  const ownerScope = canLeads && !manageLeads ? user.email.toLowerCase() : undefined;

  const [m, campaigns, allLeads, demos] = await Promise.all([
    dashboardMetrics(undefined, { from, to, ownerEmail: ownerScope }),
    canCampaigns ? campaignStats() : Promise.resolve([]),
    canLeads ? listLeads() : Promise.resolve([]),
    canLeads ? listDemos() : Promise.resolve([]),
  ]);

  const myLeads = ownerScope
    ? allLeads.filter((l) => (l.ownerEmail ?? "").toLowerCase() === ownerScope)
    : allLeads;
  const openStages = new Set(["new", "contacted", "qualified", "demo_booked", "demo_done", "trial"]);

  // ACT — attention rail inputs
  const now = Date.now();
  const overdueFollowUps = myLeads
    .filter((l) => openStages.has(l.stage) && l.nextFollowUpAt && Date.parse(l.nextFollowUpAt) < now)
    .sort((a, b) => Date.parse(a.nextFollowUpAt!) - Date.parse(b.nextFollowUpAt!));
  const unassigned = manageLeads
    ? myLeads.filter((l) => openStages.has(l.stage) && !l.ownerEmail)
    : [];
  const stale = myLeads.filter((l) => {
    if (!openStages.has(l.stage)) return false;
    const t = Date.parse(l.updatedAt ?? l.createdAt);
    return now - t > 14 * 86_400_000;
  });

  const exceptions: ExceptionItem[] = [];
  for (const l of overdueFollowUps.slice(0, 4)) {
    exceptions.push({
      id: `fup-${l.id}`,
      title: `Follow-up overdue: ${l.name}`,
      detail: `Due ${fmtDate(l.nextFollowUpAt!)} · ${l.company ?? l.propertyName ?? ""}`,
      href: `/marketing-admin/leads/${l.id}`,
      tone: "danger",
    });
  }
  if (manageLeads && unassigned.length > 0) {
    exceptions.push({
      id: "unassigned",
      title: `${unassigned.length} unassigned lead${unassigned.length === 1 ? "" : "s"}`,
      detail: "Assign an owner so nothing falls through",
      href: "/marketing-admin/leads?unassigned=1",
      tone: "warning",
    });
  }
  if (stale.length > 0) {
    exceptions.push({
      id: "stale",
      title: `${stale.length} lead${stale.length === 1 ? "" : "s"} idle 14+ days`,
      detail: "Open pipeline with no recent activity",
      href: "/marketing-admin/pipeline",
      tone: "warning",
    });
  }

  const rangeLabel =
    range != null
      ? `${range}d`
      : from || to
        ? `${from ?? "…"} → ${to ?? "…"}`
        : "all time";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing Command Center</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {role ? (ROLE_LABELS[role] ?? role) : "Team"} view · live numbers, no fabricated metrics · {rangeLabel}
            {ownerScope ? ` · owned by you` : ""}
          </p>
        </div>
        {canAnalytics && <RangeTabs basePath="/marketing-admin" current={range} />}
      </div>

      {/* ANSWER */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {canLeads && (
          <>
            <KpiTile label="New leads" value={m.kpis.newLeadsToday} hint={`${m.kpis.newLeads7d} in 7 days`} href="/marketing-admin/leads" />
            <KpiTile label="Total leads" value={m.kpis.totalLeads} accent="text-indigo-600 dark:text-indigo-400" href="/marketing-admin/leads" />
            <KpiTile label="Qualified" value={m.kpis.qualified} href="/marketing-admin/leads?stage=qualified" />
            <KpiTile label="Demo requests" value={m.kpis.demoRequests} href="/marketing-admin/demos" />
            <KpiTile label="Trials" value={m.kpis.trials} href="/marketing-admin/leads?stage=trial" />
            <KpiTile label="Converted" value={m.kpis.conversions} accent="text-emerald-600 dark:text-emerald-400" href="/marketing-admin/leads?stage=won" />
            <KpiTile
              label="Follow-ups due"
              value={m.kpis.followUpsDue}
              accent={m.kpis.followUpsDue > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              href="/marketing-admin/leads"
            />
            <KpiTile
              label="Pipeline value"
              value={leadValueLabel(m.kpis.pipelineValue)}
              hint={`${m.kpis.won} won · ${m.kpis.lost} lost`}
              accent="text-emerald-600 dark:text-emerald-400"
              href="/marketing-admin/pipeline"
            />
            <KpiTile
              label="Win rate"
              value={m.kpis.winRate == null ? "—" : `${m.kpis.winRate}%`}
              hint={`${m.kpis.won} / ${m.kpis.won + m.kpis.lost} closed`}
              href="/marketing-admin/leads?stage=won"
            />
            <KpiTile
              label="Avg cycle"
              value={m.kpis.avgDaysToWon == null ? "—" : `${m.kpis.avgDaysToWon}d`}
              hint="Created → won"
            />
          </>
        )}
        {!canLeads && (
          <>
            <KpiTile label="Total leads" value={m.kpis.totalLeads} hint="All-time inbound" accent="text-indigo-600 dark:text-indigo-400" />
            <KpiTile label="Converted" value={m.kpis.conversions} accent="text-emerald-600 dark:text-emerald-400" />
            <KpiTile label="Top source" value={m.kpis.topSource ? m.kpis.topSource.key.replace(/_/g, " ") : "—"} />
            <KpiTile label="Top country" value={m.kpis.topCountry?.key ?? "—"} />
          </>
        )}
      </div>

      {/* ACT + WATCH */}
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title={`Trend (${rangeLabel})`} className="lg:col-span-2">
          <MultiLine
            labels={m.trend.map((d) => d.day)}
            series={[
              { name: "Leads", color: "#6366f1", values: m.trend.map((d) => d.leads) },
              { name: "Demos", color: "#22d3ee", values: m.trend.map((d) => d.demos) },
              ...(canAnalytics ? [{ name: "Page views", color: "#94a3b8", values: m.trend.map((d) => d.views ?? 0) }] : []),
            ]}
            ariaLabel="Lead and demo trend"
          />
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Leads</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Demos</span>
            {canAnalytics && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Page views</span>}
          </div>
        </SectionCard>
        {canLeads ? (
          <ExceptionRail
            items={exceptions}
            action={
              <Link href="/marketing-admin/leads" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                All leads →
              </Link>
            }
          />
        ) : (
          <SectionCard title="Velocity (avg days in stage)">
            <ul className="space-y-1.5 text-xs">
              {m.velocity.filter((v) => v.count > 0).slice(0, 6).map((v) => (
                <li key={v.stage} className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{v.label}</span>
                  <span className="font-semibold tabular-nums">{v.avgDays == null ? "—" : `${v.avgDays}d`}</span>
                </li>
              ))}
              {m.velocity.filter((v) => v.count > 0).length === 0 && <li className="text-zinc-400">No staged leads yet</li>}
            </ul>
          </SectionCard>
        )}
      </div>

      {!canLeads && (
        <div className="grid gap-5 lg:grid-cols-3">
          <SectionCard title="Velocity (avg days in stage)" className="lg:col-span-1">
            <ul className="space-y-1.5 text-xs">
              {m.velocity.filter((v) => v.count > 0).slice(0, 6).map((v) => (
                <li key={v.stage} className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{v.label}</span>
                  <span className="font-semibold tabular-nums">{v.avgDays == null ? "—" : `${v.avgDays}d`} <span className="font-normal text-zinc-400">· {v.count}</span></span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Funnel" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {m.funnel.map((f) => (
                <div key={f.stage} className="rounded-xl border border-zinc-200 p-2 text-center dark:border-zinc-800">
                  <p className="truncate text-[10px] uppercase tracking-wide text-zinc-400">{f.label}</p>
                  <p className="text-lg font-bold tabular-nums">{f.count}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {canAnalytics && (
          <SectionCard title="Lead sources">
            {m.sources.length ? <Donut data={m.sources} centerLabel="leads" /> : <EmptyState title="No leads yet" />}
          </SectionCard>
        )}
        {canAnalytics && (
          <SectionCard title="Plan interest">
            {m.plans.length ? (
              <BarChart data={m.plans} ariaLabel="Plan interest" />
            ) : (
              <EmptyState title="No plan interest captured" />
            )}
          </SectionCard>
        )}
      </div>

      {canLeads && (
        <SectionCard title="Funnel">
          <div className="space-y-1.5">
            {m.funnel.map((f, i) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-xs">
                  <Link href={`/marketing-admin/leads?stage=${f.stage}`} className="font-medium text-zinc-600 hover:text-indigo-600 hover:underline dark:text-zinc-300">
                    {f.label}
                  </Link>
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
      )}

      {canCampaigns && (
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
      )}

      {canLeads && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard
            title={`Follow-ups due${ownerScope ? " (yours)" : ""}`}
            action={
              overdueFollowUps.length ? (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{overdueFollowUps.length}</Badge>
              ) : undefined
            }
          >
            {overdueFollowUps.length === 0 ? (
              <EmptyState title="Nothing due right now" />
            ) : (
              <ul className="space-y-2">
                {overdueFollowUps.slice(0, 8).map((l) => (
                  <li key={l.id}>
                    <Link href={`/marketing-admin/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 transition hover:border-indigo-400 dark:border-zinc-800">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{l.name}</span>
                        <span className="block truncate text-xs text-zinc-400">{l.company || l.propertyName || l.email}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block text-xs font-semibold ${Date.parse(l.nextFollowUpAt!) < Date.now() ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {fmtDate(l.nextFollowUpAt!)}
                        </span>
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
                {m.recentEvents.slice(0, 8).map((e) => (
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
      )}

      {canLeads && (
        <SectionCard title="Demos today" action={demos.length ? <Badge>{m.demosToday.length}</Badge> : undefined}>
          {m.demosToday.length === 0 ? (
            <EmptyState title="No demos scheduled today" body="Book one from the Demos page." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {m.demosToday.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <Link href={`/marketing-admin/leads/${d.leadId}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                    {myLeads.find((l) => l.id === d.leadId)?.name ?? d.leadId}
                  </Link>
                  <span className="tabular-nums text-xs text-zinc-500">{new Date(d.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  <Badge className={STAGE_STYLES[d.status === "converted" || d.status === "completed" ? "won" : d.status === "cancelled" || d.status === "no_show" ? "lost" : "demo_booked"]}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
