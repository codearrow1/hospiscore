"use client";

import { useMemo } from "react";
import { startOfWeek, isoDay, type DemoRow } from "@/lib/marketing/demosView";
import { timeOf, dayLabel, STATUS_ACCENT } from "./demoUi";

const HOUR_H = 56; // px per hour
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const FIRST_HOUR = 8;
const LAST_HOUR = 18;
const GRID_H = (LAST_HOUR - FIRST_HOUR) * HOUR_H;

function toPx(startAt: string, dayStartMs: number, durationMin: number): { top: number; height: number } {
  const start = Date.parse(startAt);
  const minutes = (start - dayStartMs) / 60_000;
  const top = Math.max(0, minutes) * (HOUR_H / 60);
  const endMin = Math.min(LastMinutes(startAt, durationMin), (LAST_HOUR - FIRST_HOUR) * 60);
  const startClamped = Math.max(0, Math.min(minutes, (LAST_HOUR - FIRST_HOUR) * 60));
  const height = Math.max(24, (endMin - startClamped) * (HOUR_H / 60));
  return { top, height };
}
function LastMinutes(startAt: string, durationMin: number): number {
  const start = Date.parse(startAt);
  const d = new Date(start);
  return d.getHours() * 60 + d.getMinutes() + durationMin - FIRST_HOUR * 60;
}

export function DemoCalendarWeek({
  demos,
  weekStart,
  onOpen,
  now,
}: {
  demos: DemoRow[];
  weekStart?: string;
  onOpen: (id: string) => void;
  now: number;
}) {
  const anchor = useMemo(() => {
    if (weekStart) {
      const p = new Date(`${weekStart}T00:00:00`);
      if (!Number.isNaN(p.getTime())) return startOfWeek(p);
    }
    return startOfWeek(new Date(now));
  }, [weekStart, now]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86_400_000)),
    [anchor],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, DemoRow[]>();
    for (const d of demos) {
      const key = isoDay(new Date(d.startAt));
      const list = map.get(key) ?? (map.set(key, []).get(key)!);
      list.push(d);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    return map;
  }, [demos]);

  const todayKey = isoDay(new Date(now));
  const weekCount = days.reduce((n, d) => n + (byDay.get(isoDay(d))?.length ?? 0), 0);

  const dayStartMs = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), FIRST_HOUR, 0, 0).getTime();
  const nowMinutes = (() => {
    const d = new Date(now);
    return (d.getHours() - FIRST_HOUR) * 60 + d.getMinutes();
  })();

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="min-w-[46rem]">
        {/* Day headers */}
        <div className="flex border-b border-line">
          <div className="w-14 shrink-0" />
          {days.map((d) => {
            const isToday = isoDay(d) === todayKey;
            const count = byDay.get(isoDay(d))?.length ?? 0;
            return (
              <div
                key={d.getTime()}
                className={`flex-1 border-l border-line px-2 py-2 text-center ${isToday ? "bg-brand-soft" : ""}`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wide ${isToday ? "text-brand dark:text-indigo-300" : "text-zinc-400"}`}>
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className={`text-sm font-semibold tabular-nums ${isToday ? "text-brand dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-200"}`}>
                  {d.getDate()}
                </p>
                <p className="text-[10px] font-medium text-zinc-300 dark:text-zinc-600">
                  {count === 0 ? "free" : `${count} demo${count === 1 ? "" : "s"}`}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time gutter + day lanes */}
        <div className="flex">
          <div className="relative w-14 shrink-0" style={{ height: GRID_H }}>
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-zinc-400"
                style={{ top: (h - FIRST_HOUR) * HOUR_H }}
              >
                {h % 12 === 0 ? 12 : h % 12}{h >= 12 ? "p" : "a"}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const items = byDay.get(isoDay(day)) ?? [];
            const isToday = isoDay(day) === todayKey;
            const startMs = dayStartMs(day);
            return (
              <div key={day.getTime()} className={`relative flex-1 border-l border-line ${isToday ? "bg-brand-soft/40" : ""}`} style={{ height: GRID_H }}>
                {/* Hour gridlines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute left-0 right-0 h-px bg-line"
                    style={{ top: (h - FIRST_HOUR) * HOUR_H }}
                  />
                ))}
                {isToday && nowMinutes >= 0 && nowMinutes <= (LAST_HOUR - FIRST_HOUR) * 60 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10"
                    style={{ top: nowMinutes * (HOUR_H / 60) }}
                  >
                    <div className="relative">
                      <span className="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span className="absolute left-0 right-0 h-px bg-rose-500" />
                    </div>
                  </div>
                )}
                {items.map((d) => {
                  const { top, height } = toPx(d.startAt, startMs, d.durationMin);
                  const accent = STATUS_ACCENT[d.status] ?? STATUS_ACCENT.new;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onOpen(d.id)}
                      style={{ top, height }}
                      className={`absolute left-1 right-1 z-[5] flex cursor-pointer flex-col overflow-hidden rounded-lg border-l-4 bg-white px-2 py-1 text-left shadow-sm transition hover:shadow-md dark:bg-zinc-900 ${accent.border}`}
                    >
                      <span className="text-[11px] font-bold tabular-nums text-zinc-600 dark:text-zinc-300">
                        {timeOf(d.startAt)}
                      </span>
                      <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">{d.leadName}</span>
                      {d.assignedTo && (
                        <span className="truncate text-[10px] text-zinc-400">→ {d.assignedTo.split("@")[0]}</span>
                      )}
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <p className="pointer-events-none absolute inset-x-1 top-2 text-center text-[10px] text-zinc-300 dark:text-zinc-600">
                    —
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {weekCount === 0 && (
        <p className="border-t border-line px-4 py-6 text-center text-sm text-zinc-400">
          No demos this week in the current view.
        </p>
      )}
      <p className="sr-only">{dayLabel(new Date(now))}</p>
    </div>
  );
}