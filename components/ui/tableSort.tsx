"use client";

/**
 * Client-side table sorting with full screen-reader semantics.
 * Headers render real buttons inside <th aria-sort="…"> so keyboard users can
 * sort without a pointer, and state is announced ("ascending"/"descending").
 * Third click on a header clears sorting back to the server order.
 */

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;

export type SortAccessors<T> = Record<string, (row: T) => string | number | null | undefined>;

/** Stable sort by the active header. Rows with no value always sink to the end. */
export function sortRows<T>(rows: T[], accessors: SortAccessors<T>, sort: SortState): T[] {
  if (!sort || !accessors[sort.key]) return rows;
  const get = accessors[sort.key];
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "number" && typeof vb === "number") return va < vb ? -dir : dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}

/** asc → desc → cleared cycle. */
export function nextSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (next: SortState) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const dir = active ? sort.dir : null;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey))}
        className="inline-flex min-h-9 items-center gap-1 tracking-wide transition hover:text-zinc-700 dark:hover:text-zinc-200"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span aria-hidden="true" className={`inline-block w-2.5 text-[10px] leading-none ${active ? "opacity-90" : "opacity-40"}`}>
          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "⇅"}
        </span>
      </button>
    </th>
  );
}
