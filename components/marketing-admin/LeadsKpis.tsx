"use client";

import { KpiCard } from "@/components/ui/SectionCard";
import { formatPct, formatMoney } from "@/lib/format";

export interface LeadsKpiData {
  total: number;
  newThisWeek: number;
  qualified: number;
  open: number;
  hot: number;
  overdueFollowUps: number;
  won: number;
  conversionRate: number | null;
  closedDeals: number;
}

export interface FunnelItem {
  stage: string;
  count: number;
}

export function LeadsKpis({
  kpis,
  openValue,
  href,
}: {
  kpis: LeadsKpiData;
  openValue: { currency: string; value: number }[];
  href: (patch: Record<string, string>) => string;
}) {
  const openValueText = openValue.length
    ? openValue.map((v) => `${formatMoney(v.value, v.currency)}`).join(" + ")
    : "—";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
      <KpiCard label="Total" value={kpis.total} accent="text-zinc-900 dark:text-zinc-50" />
      <KpiCard label="New (7d)" value={kpis.newThisWeek} accent="text-sky-600 dark:text-sky-400" href={href({ stage: "new" })} />
      <KpiCard label="Qualified" value={kpis.qualified} accent="text-indigo-600 dark:text-indigo-400" href={href({ stage: "qualified" })} />
      <KpiCard label="Open" value={kpis.open} hint={openValueText} accent="text-emerald-600 dark:text-emerald-400" />
      <KpiCard label="Hot" value={kpis.hot} accent="text-rose-600 dark:text-rose-400" href={href({ band: "hot" })} />
      <KpiCard label="Overdue" value={kpis.overdueFollowUps} accent={kpis.overdueFollowUps > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"} />
      <KpiCard label="Won" value={kpis.won} accent="text-emerald-600 dark:text-emerald-400" href={href({ stage: "won" })} />
      <KpiCard
        label="Win rate"
        value={kpis.conversionRate === null ? "—" : formatPct(kpis.conversionRate / 100)}
        hint={`${kpis.won} won / ${kpis.closedDeals} closed`}
        accent="text-zinc-900 dark:text-zinc-50"
      />
    </div>
  );
}

export function FunnelStrip({ items, href }: { items: FunnelItem[]; href: (patch: Record<string, string>) => string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((f) => (
        <a
          key={f.stage}
          href={href({ stage: f.stage })}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm transition hover:border-indigo-300 dark:text-zinc-300"
        >
          <span className="capitalize">{f.stage.replace(/_/g, " ")}</span>
          <span className="tabular-nums text-zinc-400">{f.count}</span>
          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(f.count / max) * 100}%` }} />
          </span>
        </a>
      ))}
    </div>
  );
}
