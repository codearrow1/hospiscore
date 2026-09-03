import Link from "next/link";
import type { ReactNode } from "react";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { saasMetrics, saasOpsSummary, centsToLabel } from "@/lib/saas/metrics";
import { seedDefaultPlans } from "@/lib/saas/plans";
import { initSaasDb } from "@/lib/saas/init";
import { listHealth } from "@/lib/saas/health";
import { revenueByCountry, churnCohort } from "@/lib/saas/analytics";
import { hasSaasPerm, type SaasPermission } from "@/lib/saas/roles";
import { KpiTile, type KpiDelta } from "@/components/dashboards/KpiTile";
import { ExceptionRail, type ExceptionItem } from "@/components/dashboards/ExceptionRail";
import { RangeTabs } from "@/components/dashboards/RangeTabs";
import { MultiLine, BarChart } from "@/components/dashboards/charts-interactive";
import { SectionCard, EmptyState, StatusBadge, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function money(cents: number): string {
  return cents == null ? "—" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** MRR delta: latest point vs the point one week earlier in the window. */
function mrrDelta(series: { day: string; mrr: number }[]): KpiDelta | undefined {
  if (series.length < 8) return undefined;
  const last = series[series.length - 1].mrr;
  const prev = series[series.length - 8].mrr;
  if (prev <= 0 || last <= 0) return undefined;
  return { pct: Math.round(((last - prev) / prev) * 1000) / 10, goodWhen: "up" };
}

function SectionFail({ label, error }: { label: string; error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[saas-command-center] ${label} failed:`, msg);
  return (
    <SectionCard title={label}>
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Unavailable</p>
        <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">{msg}</p>
      </div>
    </SectionCard>
  );
}

export default async function SaasDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("SaaS Command Center", "Platform owner access required.");
  const user = guard.user;

  await initSaasDb().catch((e) => console.error("[saas-command-center] initSaasDb retry failed:", e?.message ?? e));
  await seedDefaultPlans().catch((e) => console.error("[saas-command-center] seedDefaultPlans failed:", e?.message ?? e));

  const sp = (await searchParams) ?? {};
  const range = ["7", "30", "90"].includes(sp.range ?? "") ? (sp.range as string) : "30";
  const days = Number(range);

  const p = (perm: SaasPermission) => hasSaasPerm(user, perm);
  const canCustomers = p("CUSTOMER_VIEW");
  const canSubs = p("SUBSCRIPTION_VIEW") && canCustomers;
  const canBilling = p("BILLING_VIEW");
  const canSupport = p("SUPPORT_VIEW");
  const canApprovals = p("PLAN_VIEW");
  const canManage = p("CUSTOMER_MANAGE");

  const [metricsResult, opsResult, healthResult, countryResult, churnResult] = await Promise.allSettled([
    saasMetrics(days),
    saasOpsSummary(),
    listHealth({}),
    revenueByCountry(),
    churnCohort(6),
  ]);

  const m = metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const ops = opsResult.status === "fulfilled" ? opsResult.value : null;
  const health = healthResult.status === "fulfilled" ? healthResult.value : null;
  const country = countryResult.status === "fulfilled" ? countryResult.value : null;
  const churn = churnResult.status === "fulfilled" ? churnResult.value : null;

  const atRisk = health
    ? health.items
        .filter((h) => h.healthStatus === "at_risk" || h.healthStatus === "critical")
        .sort((a, b) => (a.healthScore ?? 0) - (b.healthScore ?? 0))
        .map((h) => ({ ...h, healthStatus: h.healthStatus ?? "stable" }))
    : [];

  // ANSWER — what is happening
  const kpis: ReactNode[] = [];
  if (canSubs) {
    if (m) {
      kpis.push(
        <KpiTile key="mrr" label="MRR" value={money(m.mrr)} delta={mrrDelta(m.mrrGrowth)} accent="text-emerald-600 dark:text-emerald-400" href="/saas/subscriptions" />,
        <KpiTile key="arr" label="ARR" value={money(m.arr)} hint="MRR × 12" href="/saas/subscriptions" />,
        <KpiTile key="customers" label="Active customers" value={m.activeCustomers} hint={`${m.totalCustomers} total · +${m.newCustomersWindow} in range`} href="/saas/organizations" />,
        <KpiTile key="trialconv" label="Trial conversion" value={m.trialConversion == null ? "—" : `${m.trialConversion}%`} hint={`${m.trials} open trials`} accent={m.trialConversion != null && m.trialConversion < 20 ? "text-amber-600 dark:text-amber-400" : undefined} href="/saas/subscriptions?status=trial" />,
        <KpiTile key="churn" label="Churn (30d)" value={m.churnRate == null ? "—" : `${m.churnRate}%`} accent={m.churnRate != null && m.churnRate > 5 ? "text-rose-600 dark:text-rose-400" : undefined} href="/saas/subscriptions?status=cancelled" />,
        <KpiTile key="arpu" label="ARPU" value={centsToLabel(m.arpu)} hint="MRR / active customers" />,
      );
    }
  }
  if (canBilling) {
    if (ops) {
      kpis.push(
        <KpiTile key="ar" label="Outstanding AR" value={money(ops.outstandingArCents)} hint={`${ops.openInvoiceCount} open invoices`} accent={ops.outstandingArCents > 0 ? "text-amber-600 dark:text-amber-400" : undefined} href="/saas/billing" />,
        <KpiTile key="dunning" label="Overdue / dunning" value={ops.overdueInvoiceCount + ops.dunningActiveCount} hint={`${ops.overdueInvoiceCount} overdue · ${ops.dunningActiveCount} dunning`} accent={ops.overdueInvoiceCount + ops.dunningActiveCount > 0 ? "text-rose-600 dark:text-rose-400" : undefined} href="/saas/billing" />,
      );
    }
  }
  if (canSupport) {
    if (ops) {
      kpis.push(
        <KpiTile key="sla" label="Open SLA breaches" value={ops.slaBreachedCount} accent={ops.slaBreachedCount > 0 ? "text-rose-600 dark:text-rose-400" : undefined} href="/saas/support" />,
      );
    }
  }
  if (canApprovals) {
    if (ops) {
      kpis.push(
        <KpiTile key="approvals" label="Pending approvals" value={ops.pendingApprovalCount} hint="Plan change requests" accent={ops.pendingApprovalCount > 0 ? "text-sky-600 dark:text-sky-400" : undefined} href="/saas/plan-approvals" />,
      );
    }
  }

  // ACT — what needs attention
  const exceptions: ExceptionItem[] = [];
  for (const h of atRisk.slice(0, 4)) {
    exceptions.push({
      id: `health-${h.id}`,
      title: `${h.legalName} — ${h.healthStatus.replace("_", " ")}`,
      detail: `Health score ${h.healthScore ?? "—"} · ${h.businessName ?? ""}`,
      href: `/saas/organizations/${h.id}`,
      tone: h.healthStatus === "critical" ? "danger" : "warning",
    });
  }
  if (canBilling && ops && ops.dunningActiveCount > 0) {
    exceptions.push({
      id: "dunning",
      title: `${ops.dunningActiveCount} active dunning case${ops.dunningActiveCount === 1 ? "" : "s"}`,
      detail: "Failed payment recovery in progress",
      href: "/saas/billing",
      tone: "danger",
    });
  }
  if (canSupport && ops && ops.slaBreachedCount > 0) {
    exceptions.push({
      id: "sla",
      title: `${ops.slaBreachedCount} SLA breach${ops.slaBreachedCount === 1 ? "" : "es"}`,
      detail: "Tickets past their response deadline",
      href: "/saas/support",
      tone: "danger",
    });
  }
  if (canApprovals && ops && ops.pendingApprovalCount > 0) {
    exceptions.push({
      id: "approvals",
      title: `${ops.pendingApprovalCount} plan request${ops.pendingApprovalCount === 1 ? "" : "s"} awaiting review`,
      href: "/saas/plan-approvals",
      tone: "info",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SaaS Command Center</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Commercial control plane — revenue, customers, collections, and support standing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeTabs basePath="/saas" current={range} />
          {canManage && (
            <LinkButton href="/saas/organizations" size="sm">
              + Organization
            </LinkButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis}
        {!canSubs && !canBilling && !canSupport && !canApprovals && (
          <div className="col-span-full">
            <EmptyState title="No console sections available" body="Your role does not include SaaS view permissions." />
          </div>
        )}
        {canSubs && !m && (
          <div className="col-span-full">
            <SectionFail label="Subscription KPIs" error={metricsResult.status === "rejected" ? metricsResult.reason : "Metrics unavailable"} />
          </div>
        )}
        {(canBilling || canSupport || canApprovals) && !ops && (
          <div className="col-span-full">
            <SectionFail label="Operations KPIs" error={opsResult.status === "rejected" ? opsResult.reason : "Operations data unavailable"} />
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {canSubs && (
          <>
            {m ? (
              <SectionCard title={`MRR trend (${range}d)`} className="min-w-0 lg:col-span-2">
                {m.mrrGrowth.every((d) => d.mrr === 0) ? (
                  <EmptyState title="No MRR yet" body="Create an organization + subscription to see growth." />
                ) : (
                  <MultiLine
                    labels={m.mrrGrowth.map((d) => d.day)}
                    series={[{ name: "MRR", color: "#6366f1", values: m.mrrGrowth.map((d) => Math.round(d.mrr / 100)) }]}
                    money
                    ariaLabel="MRR trend"
                  />
                )}
              </SectionCard>
            ) : (
              <div className="lg:col-span-2">
                <SectionFail label={`MRR trend (${range}d)`} error={metricsResult.status === "rejected" ? metricsResult.reason : "Unavailable"} />
              </div>
            )}
          </>
        )}
        <ExceptionRail items={exceptions} className={canSubs ? "" : "lg:col-span-3"} />
      </div>

      {canSubs && m && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Revenue by plan" className="min-w-0">
            {m.revenueByPlan.length === 0 ? (
              <EmptyState title="No revenue by plan" />
            ) : (
              <BarChart
                data={m.revenueByPlan.slice(0, 8).map((r) => ({ key: r.plan, count: Math.round(r.mrr / 100) }))}
                money
                ariaLabel="Revenue by plan"
              />
            )}
          </SectionCard>
          {churn ? (
            <SectionCard title="Churn cohort (6mo)" className="min-w-0">
              {churn.every((c) => c.lost === 0) ? (
                <EmptyState title="No churn recorded" body="Cancelled/expired subscriptions appear here by month." />
              ) : (
                <>
                  <BarChart data={churn.map((c) => ({ key: c.month.slice(2), count: c.lost }))} barClass="fill-rose-500" ariaLabel="Churned subscriptions per month" />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {churn.reduce((s, c) => s + c.lost, 0)} lost · {money(churn.reduce((s, c) => s + c.lostMrr, 0))} MRR lost over 6 months
                  </p>
                </>
              )}
            </SectionCard>
          ) : (
            <SectionFail label="Churn cohort (6mo)" error={churnResult.status === "rejected" ? churnResult.reason : "Unavailable"} />
          )}
        </div>
      )}

      {canSubs && m && (
        <div className="grid gap-5 lg:grid-cols-2">
          {country ? (
            <SectionCard title="MRR by country (top 8)" className="min-w-0">
              {country.length === 0 ? (
                <EmptyState title="No active customers" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                      <th className="pb-1">Country</th>
                      <th className="pb-1">Customers</th>
                      <th className="pb-1 text-right">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {country.slice(0, 8).map((c) => (
                      <tr key={c.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                        <td className="py-1.5 font-medium">{c.key}</td>
                        <td className="py-1.5 tabular-nums">{c.customers}</td>
                        <td className="py-1.5 text-right tabular-nums">{money(c.mrr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionFail label="MRR by country" error={countryResult.status === "rejected" ? countryResult.reason : "Unavailable"} />
          )}
          <SectionCard title="Customer funnel" className="min-w-0">
            <div className="space-y-2">
              {m.funnel.map((f, i) => (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{f.stage}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-bold tabular-nums">{f.count}</span>
                      {f.pct != null && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-zinc-800">{f.pct}%</span>}
                    </span>
                  </div>
                  {i < m.funnel.length - 1 && <div className="py-1 text-center text-[10px] text-zinc-400">↓</div>}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {canCustomers && (
        <SectionCard
          title="Customer health — at risk"
          action={
            <Link href="/saas/organizations" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              All customers →
            </Link>
          }
        >
          {atRisk.length === 0 ? (
            <EmptyState title="No at-risk customers" body="Health is computed from payments, usage recency, and subscription standing." />
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {atRisk.slice(0, 6).map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <Link href={`/saas/organizations/${h.id}`} className="truncate font-medium hover:underline">
                    {h.legalName}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-xs text-zinc-500">{h.healthScore ?? "—"}</span>
                    <StatusBadge domain="health" status={h.healthStatus} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {canManage && (
        <SectionCard title="Quick actions">
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/saas/organizations">New Organization</LinkButton>
            <LinkButton href="/saas/plans" variant="secondary">Manage Plans</LinkButton>
            <LinkButton href="/saas/billing" variant="secondary">View Billing</LinkButton>
            <LinkButton href="/saas/coupons" variant="secondary">Coupons</LinkButton>
          </div>
        </SectionCard>
      )}

      <SectionCard title="All modules">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/saas/settings", label: "Platform Settings", desc: "System-wide configuration" },
            { href: "/saas/team", label: "Team", desc: "Manage team members and roles" },
            { href: "/saas/roles", label: "Roles & Permissions", desc: "View role hierarchy" },
            { href: "/saas/affiliates", label: "Affiliates", desc: "Affiliate program and commissions" },
            { href: "/saas/partners", label: "Partners", desc: "Partner onboarding and payouts" },
            { href: "/saas/franchise", label: "Franchise", desc: "Territories and franchisees" },
            { href: "/saas/feature-flags", label: "Feature Flags", desc: "Toggle features per org" },
            { href: "/saas/dunning", label: "Dunning", desc: "Payment recovery cases" },
            { href: "/saas/usage", label: "Usage Billing", desc: "Usage-based metering" },
            { href: "/saas/properties", label: "Properties", desc: "Property management" },
            { href: "/saas/audit", label: "Audit Log", desc: "Immutable change history" },
          ].filter((l) => {
            if (l.href === "/saas/affiliates" && !p("AFFILIATE_VIEW")) return false;
            if (l.href === "/saas/partners" && !p("PARTNER_VIEW")) return false;
            if (l.href === "/saas/franchise" && !p("FRANCHISE_VIEW")) return false;
            if (l.href === "/saas/settings" && !p("SYSTEM_SETTINGS_MANAGE")) return false;
            if (l.href === "/saas/team" && !p("SYSTEM_SETTINGS_MANAGE")) return false;
            if (l.href === "/saas/roles" && !p("SYSTEM_SETTINGS_MANAGE")) return false;
            if (l.href === "/saas/feature-flags" && !p("SYSTEM_SETTINGS_MANAGE")) return false;
            if (l.href === "/saas/audit" && !p("AUDIT_VIEW")) return false;
            return true;
          }).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/10"
            >
              <div>
                <div className="text-sm font-semibold">{l.label}</div>
                <div className="text-xs text-zinc-500">{l.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <p className="text-right text-[11px] text-zinc-400 dark:text-zinc-500">
        {m ? `Generated ${new Date(m.generatedAt).toLocaleString("en-US")}` : "Metrics unavailable"}
      </p>
    </div>
  );
}
