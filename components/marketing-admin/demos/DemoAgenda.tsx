"use client";

import { useMemo } from "react";
import { startOfWeek, isoDay, type DemoRow } from "@/lib/marketing/demosView";
import { StatusBadge } from "@/components/ui/Badge";
import { timeOf, dayLabel } from "./demoUi";

export function DemoAgenda({
  demos,
  onOpen,
  now,
}: {
  demos: DemoRow[];
  onOpen: (id: string) => void;
  now: number;
}) {
  const week = useMemo(() => {
    const anchor = startOfWeek(new Date(now));
    const days = Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86_400_000));
    const map = new Map<string, DemoRow[]>();
    for (const d of demos) {
      const key = isoDay(new Date(d.startAt));
      const list = map.get(key) ?? (map.set(key, []).get(key)!);
      list.push(d);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    const todayKey = isoDay(new Date(now));
    return days.map((day) => ({
      day,
      items: map.get(isoDay(day)) ?? [],
      isToday: isoDay(day) === todayKey,
    }));
  }, [demos, now]);

  const activeCount = demos.filter((d) => d.status !== "cancelled" && d.status !== "completed" && d.status !== "no_show" && d.status !== "converted").length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-800 dark:text-zinc-100">Week agenda</span> · {dayLabel(week[0].day)} –{" "}
        {dayLabel(week[6].day)} · {activeCount} scheduled
      </div>
      {week.every((d) => d.items.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-zinc-400">
          Nothing on the calendar this week — book the first demo.
        </div>
      ) : (
        week.map(({ day, items, isToday }) => (
          <section key={isoDay(day)} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className={`flex items-center justify-between px-4 py-2 ${isToday ? "bg-brand-soft" : "bg-surface-subtle"}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-brand dark:text-indigo-300" : "text-zinc-500"}`}>
                {isToday ? "Today" : day.toLocaleDateString("en-US", { weekday: "long" })} · {day.getDate()}
              </h2>
              <span className="text-[11px] font-medium tabular-nums text-zinc-400">{items.length}</span>
            </div>
            <div className="divide-y divide-line">
              {items.length === 0 ? (
                <p className="px-4 py-3 text-xs text-zinc-300 dark:text-zinc-600">No demos</p>
              ) : (
                items.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onOpen(d.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-subtle"
                  >
                    <span className="w-14 shrink-0 text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                      {timeOf(d.startAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{d.leadName}</span>
                      <span className="block truncate text-xs text-zinc-400">
                        {[d.leadProperty || d.leadCompany, d.city, d.country].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    <StatusBadge domain="demo" status={d.status} />
                  </button>
                ))
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}