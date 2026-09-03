import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { ReactNode } from "react";

export type ExceptionItem = {
  id: string;
  title: string;
  detail?: string;
  href?: string;
  tone: "danger" | "warning" | "info";
};

const TONE_DOT: Record<ExceptionItem["tone"], string> = {
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

/** ANSWER → ACT rail: every row is a live exception with a drill-down link. */
export function ExceptionRail({
  items,
  title = "Needs attention",
  action,
  className = "",
}: {
  items: ExceptionItem[];
  title?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {items.length}
            </span>
          )}
          {action}
        </div>
      </div>
      <div className="mt-3">
        {items.length === 0 ? (
          <EmptyState title="Nothing needs attention" body="All clear across the surfaces this view watches." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {items.map((it) => {
              const inner = (
                <>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[it.tone]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{it.title}</span>
                    {it.detail ? (
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{it.detail}</span>
                    ) : null}
                  </span>
                  {it.href ? <span className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400">Open →</span> : null}
                </>
              );
              return (
                <li key={it.id}>
                  {it.href ? (
                    <Link href={it.href} className="-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      {inner}
                    </Link>
                  ) : (
                    <div className="-mx-2 flex items-start gap-2.5 px-2 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
