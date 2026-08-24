"use client";

import type { ReactNode } from "react";

/** Sticky bar shown when table rows are selected; hosts bulk action buttons. */
export function BulkActionBar({
  count,
  onClear,
  children,
  busy = false,
}: {
  count: number;
  onClear: () => void;
  children?: ReactNode;
  busy?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-3 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/95 px-3 py-2 shadow-lg backdrop-blur dark:border-indigo-800 dark:bg-indigo-950/90"
    >
      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
        {count} selected
      </span>
      <div className={`flex flex-wrap items-center gap-1.5 ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {children}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900"
      >
        Clear selection
      </button>
    </div>
  );
}
