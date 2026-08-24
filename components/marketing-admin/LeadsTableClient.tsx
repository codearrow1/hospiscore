"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BulkStageBar, FilterChipLink, LeadRowLite, NewLeadModal, RevenueRow } from "./LeadTable";
import { EmptyState, btnGhost } from "./ui";
import SavedViews from "./SavedViews";

export default function LeadsTableClient({
  rows,
  filterBar,
  exportHref,
  total,
  page,
  perPage,
  totalPages,
  sort,
  dir,
  ownerOptions,
}: {
  rows: LeadRowLite[];
  filterBar: ReactNode;
  exportHref: string;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  sort: string;
  dir: string;
  ownerOptions: { email: string; name: string }[];
  initialFilters?: Record<string, string>;
}) {
  const pageHref = (p: number) => {
    const q = new URLSearchParams(sp.toString());
    q.set("page", String(p));
    return `${pathname}?${q.toString()}`;
  };
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (sp.get("new") === "1" && !showNew) {
      setShowNew(true);
      const p = new URLSearchParams(sp.toString());
      p.delete("new");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [sp, showNew, pathname, router]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  return (
    <div className="space-y-4">
      <SavedViews />
      <div className="flex flex-wrap items-center gap-3">
        {filterBar}
        <button className={btnGhost} onClick={() => setShowNew(true)}>+ New lead</button>
        <a className={btnGhost} href={exportHref}>Export CSV</a>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <label className="text-zinc-500">Per page</label>
          <select
            value={perPage}
            onChange={(e) => {
              const p = new URLSearchParams(sp.toString());
              p.set("perPage", e.target.value);
              p.delete("page");
              router.push(`${pathname}?${p.toString()}`);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <BulkStageBar selected={[...selected]} onDone={() => setSelected(new Set())} ownerOptions={ownerOptions} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No leads match these filters" body="Adjust the filters or create a lead." />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="hidden border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-400 md:table-row dark:border-zinc-800">
                <th className="py-2.5 pl-2 pr-1 font-semibold">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4 accent-indigo-600"
                  />
                </th>
                <ThSort label="Lead" field="name" sort={sort} dir={dir} />
                <th className="py-2.5 pr-3 font-semibold">Company / property</th>
                <th className="py-2.5 pr-3 font-semibold">Country</th>
                <th className="py-2.5 pr-3 font-semibold">Plan</th>
                <ThSort label="Stage" field="stage" sort={sort} dir={dir} />
                <th className="py-2.5 pr-3 font-semibold">Rooms</th>
                <th className="py-2.5 pr-3 font-semibold">Est. value</th>
                <th className="py-2.5 pr-3 font-semibold">Follow-up</th>
                <th className="py-2.5 pr-3 font-semibold">Owner</th>
                <ThSort label="Score" field="score" sort={sort} dir={dir} align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RevenueRow key={r.id} lead={r} selected={selected.has(r.id)} onSelect={toggle} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {total} total · page {page} of {totalPages} · {rows.length} shown
        </span>
        <div className="flex items-center gap-1.5">
          <a
            href={page > 1 ? pageHref(page - 1) : undefined}
            aria-disabled={page <= 1}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${page <= 1 ? "pointer-events-none border-zinc-200 text-zinc-300 dark:border-zinc-800" : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"}`}
          >
            ← Prev
          </a>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) p = i + 1;
            else if (page <= 4) p = i + 1;
            else if (page >= totalPages - 3) p = totalPages - 6 + i;
            else p = page - 3 + i;
            return (
              <a
                key={p}
                href={pageHref(p)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${p === page ? "bg-indigo-600 text-white" : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"}`}
              >
                {p}
              </a>
            );
          })}
          <a
            href={page < totalPages ? pageHref(page + 1) : undefined}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${page >= totalPages ? "pointer-events-none border-zinc-200 text-zinc-300 dark:border-zinc-800" : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"}`}
          >
            Next →
          </a>
        </div>
      </div>

      <NewLeadModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(id) => router.push(`/marketing-admin/leads/${id}`)}
      />
    </div>
  );
}

function ThSort({
  label,
  field,
  sort,
  dir,
  align,
}: {
  label: string;
  field: string;
  sort: string;
  dir: string;
  align?: "right";
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sort === field;
  const nextDir = active && dir === "desc" ? "asc" : "desc";
  const href = () => {
    const p = new URLSearchParams(sp.toString());
    p.set("sort", field);
    p.set("dir", nextDir);
    return `${pathname}?${p.toString()}`;
  };
  return (
    <th className={`py-2.5 pr-3 font-semibold ${align === "right" ? "text-right" : ""}`}>
      <a href={href()} className={`inline-flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </a>
    </th>
  );
}

export { FilterChipLink };