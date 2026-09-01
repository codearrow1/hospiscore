"use client";

import { useMemo } from "react";
import { KpiCard } from "@/components/ui/index";
import { formatMoney } from "@/lib/format";
import {
  pipelineKpis,
  type PipelineDeal,
} from "@/lib/marketing/pipeline";
import type { LeadStage } from "@/lib/marketing/types";

function joinCurrencies(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency).filter(([, v]) => v > 0);
  if (entries.length === 0) return "—";
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([cur, v]) => formatMoney(v, cur))
    .join(" + ");
}

export function PipelineKpis({
  deals,
  weights,
  wonThisMonth,
  now,
}: {
  deals: readonly PipelineDeal[];
  weights?: Partial<Record<LeadStage, number>>;
  wonThisMonth: number;
  now: number;
}) {
  const kpis = useMemo(() => pipelineKpis(deals, weights, { wonThisMonth, now }), [deals, weights, wonThisMonth, now]);

  const weightedHint = !weights || Object.keys(weights).length === 0
    ? "No closed-deal history yet — not guessed"
    : kpis.weightedAvailable
      ? "Weighted by real close history per stage"
      : "Partial — some early stages have no closed evidence";

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1" role="list" aria-label="Pipeline KPIs">
      <div className="w-44 shrink-0">
        <KpiCard label="Open deals" value={kpis.open} hint="Active pipeline deals" />
      </div>
      <div className="w-52 shrink-0">
        <KpiCard
          label="Pipeline value"
          value={joinCurrencies(kpis.valueByCurrency)}
          hint="Estimated annual value by currency"
          accent="text-emerald-700 dark:text-emerald-400"
        />
      </div>
      <div className="w-52 shrink-0">
        <KpiCard
          label="Weighted pipeline"
          value={kpis.weightedAvailable || Object.keys(kpis.weightedByCurrency).length > 0 ? joinCurrencies(kpis.weightedByCurrency) : "—"}
          hint={weightedHint}
          accent="text-indigo-700 dark:text-indigo-400"
        />
      </div>
      <div className="w-44 shrink-0">
        <KpiCard
          label="Due this week"
          value={kpis.dueSoon}
          hint="Follow-up due ≤ 7 days (incl. overdue)"
        />
      </div>
      <div className="w-44 shrink-0">
        <KpiCard
          label="Stale deals"
          value={kpis.stale}
          hint="No touch for ≥ 14 days"
          accent="text-amber-700 dark:text-amber-400"
        />
      </div>
      <div className="w-44 shrink-0">
        <KpiCard
          label="Won this month"
          value={kpis.wonThisMonth}
          hint="Deals closed in the current month"
          accent="text-emerald-700 dark:text-emerald-400"
        />
      </div>
      <div className="w-44 shrink-0">
        <KpiCard
          label="Win rate"
          value={kpis.winRate === null ? "—" : `${kpis.winRate.toFixed(0)}%`}
          hint={kpis.winRateSample > 0 ? `From ${kpis.winRateSample} closed deal${kpis.winRateSample === 1 ? "" : "s"}` : "No closed deals yet"}
        />
      </div>
    </div>
  );
}