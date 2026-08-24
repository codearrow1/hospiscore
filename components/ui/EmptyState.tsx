import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  icon,
  action,
  secondaryAction,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      {icon && (
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-subtle text-zinc-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</p>
      {body && <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{body}</p>}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** Shown when saved filters match nothing — distinct from a truly empty list. */
export function FilteredEmptyState({
  onClear,
  clearLabel = "Clear filters",
}: {
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <EmptyState
      title="Nothing matches these filters"
      body="Try widening your search or removing some filters."
      action={
        onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-subtle"
          >
            {clearLabel}
          </button>
        ) : undefined
      }
    />
  );
}

export function PermissionNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">View-only</p>
      <p className="mt-0.5">{message}</p>
    </div>
  );
}
