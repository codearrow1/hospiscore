"use client";

import { KpiCard } from "@/components/ui/SectionCard";
import { formatPct } from "@/lib/format";
import type { DemoKpis } from "@/lib/marketing/demosView";

export function DemosKpis({
  kpis,
  href,
}: {
  kpis: DemoKpis;
  href: (patch: Record<string, string | undefined>) => string;
}) {
  const dealRate = kpis.completed > 0 ? formatPct(kpis.toWon / kpis.completed) : "—";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <KpiCard label="Today" value={kpis.today} accent="text-indigo-600 dark:text-indigo-400" href={href({ period: "today" })} />
      <KpiCard label="Upcoming" value={kpis.upcoming} accent="text-sky-600 dark:text-sky-400" href={href({ period: "upcoming" })} />
      <KpiCard label="This week" value={kpis.thisWeek} accent="text-zinc-900 dark:text-zinc-50" href={href({ period: "week" })} />
      <KpiCard label="To confirm" value={kpis.awaitingConfirmation} accent="text-amber-600 dark:text-amber-400" href={href({ status: "new" })} />
      <KpiCard
        label="Needs follow-up"
        value={kpis.needsFollowUp}
        accent={kpis.needsFollowUp > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"}
        href={href({ followUp: "1" })}
      />
      <KpiCard label="Completed" value={kpis.completed} accent="text-emerald-600 dark:text-emerald-400" href={href({ status: "completed" })} />
      <KpiCard label="No-shows" value={kpis.noShow} accent="text-rose-600 dark:text-rose-400" href={href({ status: "no_show" })} />
      <KpiCard
        label="Demo → deal"
        value={dealRate}
        hint={kpis.completed > 0 ? `${kpis.toWon} won from ${kpis.completed} completed` : "No completed demos yet"}
        accent="text-zinc-900 dark:text-zinc-50"
      />
    </div>
  );
}