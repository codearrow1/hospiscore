"use client";

/**
 * FilterSheet — progressive-disclosure filter container.
 * Collapses secondary filter controls behind a trigger with an active-count
 * badge; opens as a full-screen sheet on phones / centered modal on desktop
 * (via AccessibleModal). Includes Clear-all when any filter is active.
 */
import { useState, type ReactNode } from "react";
import { AccessibleModal } from "@/components/ui/AccessibleModal";

export function FilterSheet({
  label = "Filters",
  activeCount = 0,
  onClearAll,
  children,
  footerExtra,
}: {
  label?: string;
  /** Number of non-default filters currently applied — shown as a badge. */
  activeCount?: number;
  onClearAll?: () => void;
  children: ReactNode;
  footerExtra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-zinc-600 shadow-sm transition hover:bg-surface-subtle dark:text-zinc-300"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
        </svg>
        {label}
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold tabular-nums text-white">
            {activeCount}
          </span>
        )}
      </button>

      <AccessibleModal open={open} onClose={() => setOpen(false)} title={label}>
        {/* Stacked one-column controls inside the sheet */}
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {onClearAll && activeCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setOpen(false);
              }}
              className="min-h-9 rounded-xl px-3 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Clear all ({activeCount})
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {footerExtra}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-9 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </div>
      </AccessibleModal>
    </>
  );
}
