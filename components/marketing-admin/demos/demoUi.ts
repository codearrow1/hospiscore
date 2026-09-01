import type { DemoStatus } from "@/lib/marketing/types";

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function dateTimeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Calendar block accent per demo status — color plus a shape-safe symbol. */
export const STATUS_ACCENT: Record<DemoStatus, { border: string; chip: string }> = {
  new: { border: "border-sky-400 dark:border-sky-500", chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300" },
  confirmed: { border: "border-indigo-400 dark:border-indigo-500", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300" },
  reschedule_requested: { border: "border-amber-400 dark:border-amber-500", chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300" },
  completed: { border: "border-emerald-400 dark:border-emerald-500", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300" },
  no_show: { border: "border-rose-400 dark:border-rose-500", chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300" },
  cancelled: { border: "border-zinc-300 dark:border-zinc-600", chip: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  converted: { border: "border-violet-400 dark:border-violet-500", chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300" },
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}