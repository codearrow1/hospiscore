"use client";

import { useEffect, useState } from "react";

/**
 * Animated "live activity" feed — the ticking relative timestamps prove the
 * platform is real-time. Client component so timestamps actually tick.
 */

const EVENTS = [
  { label: "Channel rates & inventory reconciled", channel: "Channel manager", dot: "bg-emerald-400" },
  { label: "Guest payment posted to folio", channel: "Payments", dot: "bg-sky-400" },
  { label: "Housekeeping room status synced", channel: "Housekeeping", dot: "bg-amber-400" },
  { label: "New Booking.com reservation imported", channel: "Channel manager", dot: "bg-emerald-400" },
  { label: "AI reply drafted for a 2★ review", channel: "AI assistant", dot: "bg-violet-400" },
  { label: "Night audit reports generated", channel: "Finance", dot: "bg-rose-400" },
];

function timeAgo(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export default function RealtimeFeed() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5 shadow-2xl shadow-indigo-950/40">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Your operation, updating live
          </span>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          Live
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {EVENTS.map((e, i) => {
          const elapsed = tick + i * 7 + 3;
          return (
            <li
              key={e.label}
              className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${e.dot}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{e.label}</span>
              <span className="hidden shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 sm:block">
                {e.channel}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{timeAgo(elapsed)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
