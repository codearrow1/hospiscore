import type { ScoreComponent, ScoreResult } from "@/lib/types";

export default function ScoreBreakdown({ result }: { result: ScoreResult }) {
  return (
    <div className="flex flex-col gap-3">
      {result.dataCompleteness < 100 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {result.dataCompleteness}% of criteria have real signals — the rest use a
          neutral 50 until more data is connected. Live sources (Google Business,
          review providers) will raise this.
        </p>
      )}
      {result.components.map((c) => (
        <ComponentRow key={c.key} c={c} />
      ))}
    </div>
  );
}

function ComponentRow({ c }: { c: ScoreComponent }) {
  const color =
    c.score >= 85
      ? "#2563eb"
      : c.score >= 70
        ? "#10b981"
        : c.score >= 50
          ? "#f59e0b"
          : "#dc2626";

  return (
    <div className="flex items-center gap-4">
      <div className="w-44 shrink-0 sm:w-52">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {c.label}
            {!c.sourced && (
              <span
                className="ml-1 rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                title="Estimated — no live signal connected"
              >
                est
              </span>
            )}
          </span>
          <span className="text-xs text-zinc-400">{(c.weight * 100).toFixed(0)}%</span>
        </div>
        <div
          aria-hidden="true"
          className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            className={`h-full rounded-full transition-all ${c.sourced ? "" : "opacity-60"}`}
            style={{ width: `${c.score}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <span
        className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums"
        style={{ color }}
      >
        {c.score}
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-xs text-zinc-500 sm:block dark:text-zinc-400">
        {c.detail}
      </span>
    </div>
  );
}