"use client";

import type { DemoRow, DemoSortKey, SortDir } from "@/lib/marketing/demosView";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import { dateTimeOf } from "./demoUi";

const COLUMNS: { key: DemoSortKey | null; label: string }[] = [
  { key: "lead", label: "Demo" },
  { key: "startAt", label: "When" },
  { key: null, label: "Type" },
  { key: "value", label: "Value" },
  { key: null, label: "Owner" },
  { key: null, label: "Follow-up" },
  { key: "status", label: "Status" },
];

function sortArrow(sort: DemoSortKey, dir: SortDir, key: DemoSortKey | null): string {
  return sort === key ? (dir === "asc" ? " ↑" : " ↓") : "";
}

export function DemoList({
  rows,
  total,
  page,
  perPage,
  totalPages,
  sort,
  dir,
  onOpen,
  makeHref,
}: {
  rows: DemoRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  sort: DemoSortKey;
  dir: SortDir;
  onOpen: (id: string) => void;
  makeHref: (patch: Record<string, string | undefined>) => string;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-zinc-400">
              {COLUMNS.map((c) =>
                c.key ? (
                  <th key={c.label} scope="col" className="px-4 py-2.5 font-semibold">
                    <a
                      href={makeHref({
                        sort: c.key!,
                        dir: sort === c.key && dir === "asc" ? "desc" : "asc",
                      })}
                      className="hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {c.label}
                      {sortArrow(sort, dir, c.key)}
                    </a>
                  </th>
                ) : (
                  <th key={c.label} scope="col" className="px-4 py-2.5 font-semibold">{c.label}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No demos match the current view.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr
                key={d.id}
                onClick={() => onOpen(d.id)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-subtle"
              >
                <td className="max-w-[16rem] px-4 py-3">
                  <span className="block truncate font-semibold text-zinc-800 dark:text-zinc-100">{d.leadName}</span>
                  <span className="block truncate text-xs text-zinc-400">
                    {[d.leadEmail, d.leadCompany, d.leadProperty].filter(Boolean).join(" · ") || "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300" suppressHydrationWarning>
                  {dateTimeOf(d.startAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{d.demoType || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                  {d.estimatedValue > 0 ? formatMoney(d.estimatedValue, d.estimatedValueCurrency ?? "USD") : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                  {d.assignedTo?.split("@")[0] || d.ownerName || "—"}
                </td>
                <td className="px-4 py-3">
                  {d.status === "completed" || d.status === "no_show" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/70 dark:text-amber-300" suppressHydrationWarning>
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 7v6m0 3h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                      </svg>
                      {(d.nextFollowUpAt ? new Date(d.nextFollowUpAt) > new Date() ? "follow-up set" : "follow-up overdue" : "needs follow-up")}
                    </span>
                  ) : d.status === "converted" || d.convertedCustomerId ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                      <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M20 6 9 17l-5-5" strokeWidth={2.5} />
                      </svg>
                      converted
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge domain="demo" status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 rounded-2xl border border-line bg-surface">
        <Pagination page={page} totalPages={totalPages} total={total} perPage={perPage} makeHref={(p) => makeHref({ page: p === 1 ? undefined : String(p) })} />
      </div>
    </div>
  );
}