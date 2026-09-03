import Link from "next/link";

/**
 * Link-based pagination that preserves the current URL query.
 * `makeHref(page)` lets server pages keep filters while paging.
 */
export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  makeHref,
  onNavigate,
}: {
  page: number;
  totalPages: number;
  total?: number;
  perPage: number;
  makeHref: (page: number) => string;
  onNavigate?: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return total !== undefined ? (
      <p className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
        {total} {total === 1 ? "entry" : "entries"}
      </p>
    ) : null;
  }

  const windowSize = 7;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const linkCls =
    "inline-flex min-h-11 items-center rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-subtle disabled:pointer-events-none disabled:opacity-40";
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total ?? page * perPage, page * perPage);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      {total !== undefined && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing <span className="font-semibold tabular-nums">{from}–{to}</span> of{" "}
          <span className="font-semibold tabular-nums">{total}</span>
        </p>
      )}
      <div className="flex items-center gap-1">
        {onNavigate ? (
          <>
            <button type="button" className={linkCls} disabled={page <= 1} onClick={() => onNavigate(page - 1)}>
              <svg className="h-3.5 w-3.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m15 18-6-6 6-6" /></svg>
              <span className="hidden md:inline">← Prev</span>
            </button>
            <span className="hidden min-h-11 items-center px-1.5 text-xs font-semibold tabular-nums md:inline-flex">{page}/{totalPages}</span>
            <span className="flex items-center md:hidden">
              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => onNavigate(p)}
                  className={`min-h-11 px-2 text-xs font-semibold ${p === page ? "text-brand dark:text-indigo-300" : "text-zinc-400"}`}
                >
                  {p}
                </button>
              ))}
            </span>
            <button type="button" className={linkCls} disabled={page >= totalPages} onClick={() => onNavigate(page + 1)}>
              <span className="hidden md:inline">Next →</span>
              <svg className="h-3.5 w-3.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        ) : (
          <>
            {page > 1 && (
              <Link href={makeHref(page - 1)} className={linkCls}>
                <svg className="h-3.5 w-3.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m15 18-6-6 6-6" /></svg>
                <span className="hidden md:inline">← Prev</span>
              </Link>
            )}
            <span className="hidden min-h-11 items-center px-1.5 text-xs font-semibold tabular-nums md:inline-flex">{page}/{totalPages}</span>
            <span className="flex items-center md:hidden">
              {pages.map((p) => (
                <Link
                  key={p}
                  href={makeHref(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`min-h-11 px-2 text-xs font-semibold ${p === page ? "text-brand dark:text-indigo-300" : "text-zinc-400"}`}
                >
                  {p}
                </Link>
              ))}
            </span>
            {page < totalPages && (
              <Link href={makeHref(page + 1)} className={linkCls}>
                <span className="hidden md:inline">Next →</span>
                <svg className="h-3.5 w-3.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}

/** Horizontal chip row used by FilterBar and inline filter groups. */
export function ChipRow({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && (
        <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
      )}
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  children,
  href,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const cls = `inline-flex min-h-9 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${
    active
      ? "border-indigo-300 bg-brand-soft font-semibold text-brand dark:border-indigo-700"
      : "border-line text-zinc-600 hover:bg-surface-subtle dark:text-zinc-300"
  }`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-pressed={active}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {children}
    </button>
  );
}
