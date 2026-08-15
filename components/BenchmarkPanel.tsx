import type { ScoreResult } from "@/lib/types";
import type { BenchmarkLine } from "@/lib/benchmark";

export default function BenchmarkPanel({
  result,
  benchmark,
}: {
  result: ScoreResult;
  benchmark: BenchmarkLine;
}) {
  const rows = result.components.map((c) => ({
    label: c.label,
    key: c.key,
    score: c.score,
    avg: benchmark.byKey[c.key]?.average ?? 50,
  }));

  const below = rows.filter((r) => r.score < r.avg).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Dataset average</div>
          <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {benchmark.overallAverage}
            <span className="ml-1 text-sm font-medium text-zinc-400">/ 100</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-400">Best property</div>
          <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {benchmark.overallBest}
          </div>
        </div>
        <div
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            result.overall >= benchmark.overallAverage
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          }`}
        >
          {result.overall >= benchmark.overallAverage
            ? "Above market average"
            : `${below} criteria below market`}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {r.label}
            </span>
            <div
              aria-hidden="true"
              className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-300 dark:bg-zinc-700"
                style={{ width: `${r.avg}%` }}
              />
              <div
                className="relative h-full rounded-full transition-all"
                style={{
                  width: `${r.score}%`,
                  backgroundColor: r.score >= r.avg ? "#10b981" : "#f59e0b",
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-400">
              {r.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}