import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { saasMetrics, centsToLabel } from "@/lib/saas/metrics";
import { seedDefaultPlans } from "@/lib/saas/plans";
import { listHealth } from "@/lib/saas/health";
import { KpiCard, SectionCard, EmptyState, Badge } from "@/components/marketing-admin/ui";
import { Bars, Line } from "@/components/marketing-admin/charts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SaasDashboardPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("SaaS Command Center", "Platform owner access required.");

  await seedDefaultPlans();
  const [m, health] = await Promise.all([saasMetrics(), listHealth({})]);
  const atRisk = health.items.filter((h) => h.healthStatus === "at_risk" || h.healthStatus === "critical").slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SaaS Command Center</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Commercial control plane — MRR/ARR, customers, trials, churn, usage. Live from SaaS subscriptions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="MRR" value={centsToLabel(m.mrr)} accent="text-emerald-600 dark:text-emerald-400" hint={`${centsToLabel(m.arr)} ARR`} href="/saas/subscriptions" />
        <KpiCard label="Active Customers" value={m.activeCustomers} hint={`${m.totalCustomers} total`} href="/saas/organizations" />
        <KpiCard label="New (7d)" value={m.newCustomers7d} hint={`${m.totalCustomers} total`} />
        <KpiCard label="Trials" value={m.trials} hint={m.trialConversion == null ? "no trials" : `${m.trialConversion}% → active`} href="/saas/subscriptions?status=trial" />
        <KpiCard label="Churn (30d)" value={m.churnRate == null ? "—" : `${m.churnRate}%`} accent={m.churnRate != null && m.churnRate > 5 ? "text-red-600 dark:text-red-400" : undefined} />
        <KpiCard label="ARPU" value={centsToLabel(m.arpu)} hint={m.arpu ? "MRR / active customers" : undefined} />
        <KpiCard label="LTV" value={centsToLabel(m.ltv)} hint={m.ltv ? "ARPU / churn" : undefined} />
        <KpiCard label="Properties" value={`${m.activeProperties} / ${m.totalProperties}`} hint="active / total" href="/saas/organizations" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="MRR Growth (14d)">
          {m.mrrGrowth.every((d) => d.mrr === 0) ? (
            <EmptyState title="No MRR yet" body="Create an organization + subscription to see growth." />
          ) : (
            <Line data={m.mrrGrowth.map((d) => ({ day: d.day, leads: d.mrr / 100, demos: 0, views: 0 }))} height={140} />
          )}
          <p className="mt-2 text-xs text-zinc-500">MRR in $ (cents/100). Today: {centsToLabel(m.mrr)}</p>
        </SectionCard>
        <SectionCard title="Revenue by Plan">
          {m.revenueByPlan.length === 0 ? (
            <EmptyState title="No revenue by plan" />
          ) : (
            <Bars data={m.revenueByPlan.map((r) => ({ key: r.plan, count: Math.round(r.mrr / 100) }))} labelKey="MRR $" />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Customer Funnel">
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
              {i < m.funnel.length - 1 && <div className="py-1 text-center text-[10px] text-zinc-400">↓ {f.pct ?? "—"}%</div>}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Customer Health — At Risk">
          {atRisk.length === 0 ? (
            <EmptyState title="No at-risk customers" body="Health is computed from payments, usage recency, and subscription standing." />
          ) : (
            <ul className="space-y-2">
              {atRisk.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <Link href={`/saas/organizations/${h.id}`} className="font-medium hover:underline">{h.legalName}</Link>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-xs text-zinc-500">{h.healthScore ?? "—"}</span>
                    <Badge>{h.healthStatus}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-400">Recompute via POST /api/saas/health (CUSTOMER_MANAGE).</p>
        </SectionCard>
        <SectionCard title="Quick actions">
          <div className="flex flex-wrap gap-2">
            <Link href="/saas/organizations" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">New Organization</Link>
            <Link href="/saas/plans" className="rounded-xl border bg-white px-4 py-2 text-sm dark:bg-zinc-900">Manage Plans</Link>
            <Link href="/saas/billing" className="rounded-xl border bg-white px-4 py-2 text-sm dark:bg-zinc-900">View Billing</Link>
            <Link href="/saas/coupons" className="rounded-xl border bg-white px-4 py-2 text-sm dark:bg-zinc-900">Coupons</Link>
          </div>
        </SectionCard>
        <SectionCard title="System">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Generated at {new Date(m.generatedAt).toLocaleString()}</p>
          <p className="mt-1 text-xs text-zinc-400">Data: Prisma sqlite `var/saas.db` · Plans seeded: {m.revenueByPlan.length || 0} active plans</p>
        </SectionCard>
      </div>
    </div>
  );
}
