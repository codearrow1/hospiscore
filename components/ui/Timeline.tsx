import { formatDate } from "@/lib/format";

export interface TimelineEntry {
  id: string;
  at: string | Date;
  title: string;
  body?: string;
  meta?: string;
}

const DOT_COLOR: Record<string, string> = {
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

/** Vertical event timeline with semantic dots. */
export function Timeline({
  entries,
  dotColor = "bg-zinc-400",
}: {
  entries: TimelineEntry[];
  dotColor?: keyof typeof DOT_COLOR;
}) {
  if (entries.length === 0) {
    return <p className="py-2 text-xs text-zinc-500 dark:text-zinc-400">No activity yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {entries.map((e) => {
        const date = typeof e.at === "string" ? e.at : e.at.toISOString();
        return (
          <li key={e.id} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-zinc-950 ${DOT_COLOR[dotColor] ?? "bg-zinc-400"}`}
            />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{e.title}</p>
            {e.body && (
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{e.body}</p>
            )}
            <p className="mt-1 text-[11px] text-zinc-400">
              {formatDate(date)}
              {e.meta ? ` · ${e.meta}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
