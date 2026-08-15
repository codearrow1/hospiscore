"use client";

import { useEffect, useState } from "react";

interface Snapshot {
  at: string;
  overall: number;
  grade: string;
}

/**
 * Mini sparkline of score history, fetched from the snapshot store.
 * Runs unattached until snapshots exist (the `npm run snapshot` worker fills it).
 */
export default function ScoreTrend({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/properties/${encodeURIComponent(propertyId)}/history`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { history?: Snapshot[] } | null) => setData(j?.history ?? []))
      .catch(() => setData([]));
    return () => ctrl.abort();
  }, [propertyId]);

  if (data === null) return <div className="h-24" />;

  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
        Score history builds up as the daily worker runs (try <code>npm run snapshot</code>).
      </div>
    );
  }

  const W = 100;
  const H = 40;
  const scores = data.map((d) => d.overall);
  const min = Math.min(...scores, 40);
  const max = Math.max(...scores, 90);
  const range = max - min || 1;
  const stepX = W / (data.length - 1);

  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = H - ((d.overall - min) / range) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const change = data[data.length - 1].overall - data[0].overall;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Score trend</span>
        <span
          className={`font-semibold tabular-nums ${
            change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {change >= 0 ? "+" : ""}
          {change} pts over {data.length} snapshots
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        aria-hidden
      >
        <polyline
          points={points}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}