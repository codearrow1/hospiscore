"use client";

import { useEffect, useRef, useState } from "react";

interface Snapshot {
  at: string;
  overall: number;
  grade: string;
}

/**
 * Renders a property's stored score history from the existing history API.
 * Replaces the previous static "in production…" placeholder with real data.
 */
export default function PropertyScoreHistory({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    fetch(`/api/properties/${encodeURIComponent(propertyId)}/history`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`history ${res.status}`);
        const data = (await res.json()) as { history: Snapshot[] };
        if (!cancelled) setItems(data.history);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="mt-8 animate-pulse rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
        <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-3 h-3 w-64 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (error || !items) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Score history is unavailable right now. Check back after the next snapshot.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No score snapshots recorded for this property yet — they will appear here on the
        next automated check.
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Score history
      </h2>
      <div className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
        {[...items]
          .reverse()
          .slice(0, 12)
          .map((s) => (
            <div
              key={s.at}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <span className="text-zinc-500 dark:text-zinc-400">
                {new Date(s.at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {s.grade}
                </span>
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {s.overall}/100
                </span>
              </span>
            </div>
          ))}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Stored score snapshots power the weekly alert email for this property.
      </p>
    </div>
  );
}
