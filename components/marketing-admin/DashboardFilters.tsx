"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

const PRESETS: { label: string; from?: string; to?: string }[] = [
  { label: "All time" },
  { label: "Last 7 days", from: daysAgo(7), to: todayISO() },
  { label: "Last 30 days", from: daysAgo(30), to: todayISO() },
  { label: "This month", from: monthStart(), to: todayISO() },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function DashboardFilters({
  initialFrom,
  initialTo,
}: {
  initialFrom?: string;
  initialTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");

  const apply = (nextFrom?: string, nextTo?: string) => {
    const f = nextFrom !== undefined ? nextFrom : from;
    const t = nextTo !== undefined ? nextTo : to;
    const p = new URLSearchParams(sp.toString());
    if (f) p.set("from", f);
    else p.delete("from");
    if (t) p.set("to", t);
    else p.delete("to");
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex gap-1.5">
        {PRESETS.map((pr) => {
          const active =
            (pr.from ?? "") === (initialFrom ?? "") && (pr.to ?? "") === (initialTo ?? "");
          return (
            <button
              key={pr.label}
              onClick={() => {
                setFrom(pr.from ?? "");
                setTo(pr.to ?? "");
                apply(pr.from, pr.to);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {pr.label}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          aria-label="From date"
        />
        <span className="text-xs text-zinc-400">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          aria-label="To date"
        />
        <button
          onClick={() => apply()}
          className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          Apply
        </button>
        {(initialFrom || initialTo) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
              apply("", "");
            }}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
