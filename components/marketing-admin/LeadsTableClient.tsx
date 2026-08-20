"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BulkStageBar, FilterChipLink, LeadRowLite, NewLeadModal, RevenueRow } from "./LeadTable";
import { EmptyState, btnGhost } from "./ui";

export default function LeadsTableClient({
  rows,
  filterBar,
  exportHref,
}: {
  rows: LeadRowLite[];
  filterBar: ReactNode;
  exportHref: string;
}) {
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
      <div className="flex flex-wrap items-center gap-3">
        {filterBar}
        <button className={btnGhost} onClick={() => setShowNew(true)}>+ New lead</button>
        <a className={btnGhost} href={exportHref}>Export CSV</a>
      </div>

      {selected.size > 0 && (
        <BulkStageBar selected={[...selected]} onDone={() => setSelected(new Set())} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No leads match these filters" body="Adjust the filters or create a lead." />
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="py-2.5 pl-2 pr-1 font-semibold">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4 accent-indigo-600"
                  />
                </th>
                <th className="py-2.5 pr-3 font-semibold">Lead</th>
                <th className="py-2.5 pr-3 font-semibold">Company / property</th>
                <th className="py-2.5 pr-3 font-semibold">Country</th>
                <th className="py-2.5 pr-3 font-semibold">Plan</th>
                <th className="py-2.5 pr-3 font-semibold">Stage</th>
                <th className="py-2.5 pr-3 font-semibold">Rooms</th>
                <th className="py-2.5 text-right font-semibold">Score</th>
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
      {rows.length > 0 && (
        <p className="text-xs text-zinc-400">
          {rows.length} shown · select rows to move them through the pipeline in bulk
        </p>
      )}

      <NewLeadModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(id) => router.push(`/marketing-admin/leads/${id}`)}
      />
    </div>
  );
}

export { FilterChipLink };