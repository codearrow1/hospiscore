"use client";

import type { ReactNode } from "react";

export interface DataColumn<T> {
  key: string;
  label: string;
  /** Columns with priority "low" are hidden below lg; "medium" below sm. */
  priority?: "high" | "medium" | "low";
  align?: "left" | "right";
  width?: string;
  render: (row: T) => ReactNode;
}

const PRIORITY_HIDE: Record<string, string> = {
  low: "hidden lg:table-cell",
  medium: "hidden sm:table-cell",
};

/**
 * Consistent table shell: sticky header recipe, column priorities, overflow
 * wrapper, empty/filtered states, and a mobile card renderer.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  empty,
  mobileCard,
  footer,
  dense = false,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  empty?: ReactNode;
  mobileCard?: (row: T) => ReactNode;
  footer?: ReactNode;
  dense?: boolean;
}) {
  const cellPad = dense ? "px-3 py-1.5" : "px-3 py-2.5";

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <>
      {/* Mobile card representation */}
      <div className="space-y-2 md:hidden">
        {mobileCard
          ? rows.map((row) => <div key={keyOf(row)}>{mobileCard(row)}</div>)
          : rows.map((row) => (
              <div key={keyOf(row)} className="rounded-xl border border-line bg-surface p-3 text-sm">
                {columns.slice(0, 4).map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{c.label}</span>
                    <span className="min-w-0 truncate text-right">{c.render(row)}</span>
                  </div>
                ))}
              </div>
            ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-subtle">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={undefined}
                  className={`${cellPad} whitespace-nowrap text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400 ${c.align === "right" ? "!text-right" : ""} ${PRIORITY_HIDE[c.priority ?? ""] ?? ""}`}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                className="border-b border-line transition last:border-b-0 hover:bg-surface-subtle"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${cellPad} align-middle ${c.align === "right" ? "text-right tabular-nums" : ""} ${PRIORITY_HIDE[c.priority ?? ""] ?? ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footer}
    </>
  );
}
