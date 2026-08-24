import Link from "next/link";

export type KpiDelta = {
  /** Percent change vs previous period; null/undefined renders no delta. */
  pct: number | null | undefined;
  /** Which direction is good news, for coloring. */
  goodWhen: "up" | "down";
};

export function KpiTile({
  label,
  value,
  hint,
  accent,
  icon,
  href,
  delta,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  icon?: string;
  href?: string;
  delta?: KpiDelta;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        {icon ? <span aria-hidden>{icon}</span> : null}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${accent ?? "text-zinc-900 dark:text-zinc-50"}`}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {delta && delta.pct != null && Number.isFinite(delta.pct) ? <DeltaPill delta={delta} /> : null}
        {hint ? <span className="truncate">{hint}</span> : null}
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">{body}</div>;
}

function DeltaPill({ delta }: { delta: KpiDelta }) {
  const pct = delta.pct ?? 0;
  const flat = pct === 0;
  const up = pct > 0;
  const good = flat ? null : delta.goodWhen === "up" ? up : !up;
  const cls = good == null
    ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
    : good
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  const arrow = flat ? "→" : up ? "↑" : "↓";
  const shown = Math.abs(pct);
  const label = shown >= 1000 ? `${(shown / 100).toFixed(0)}×` : `${shown.toFixed(1)}%`;
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${cls}`}>
      {arrow} {label}
    </span>
  );
}
