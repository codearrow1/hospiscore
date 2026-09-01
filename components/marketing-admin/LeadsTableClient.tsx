"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadsKpis, FunnelStrip, type LeadsKpiData, type FunnelItem } from "./LeadsKpis";
import { LeadFilters, type LeadFilterState } from "./LeadFilters";
import { BulkStageBar, NewLeadModal, RevenueRow, type LeadRowLite } from "./LeadTable";
import { EmptyState, btnGhost } from "./ui";
import SavedViews from "./SavedViews";

const COLUMN_KEY = "marketing.leadColumns";

function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(COLUMN_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

const ALL_COLUMNS = ["company", "country", "plan", "source", "value", "followup", "owner", "score"] as const;
const COLUMN_LABELS: Record<string, string> = {
  company: "Company / property",
  country: "Country",
  plan: "Plan",
  source: "Source",
  value: "Est. value",
  followup: "Follow-up",
  owner: "Owner",
  score: "Score",
};

export default function LeadsTableClient({
  rows,
  allRowsCount,
  total,
  page,
  perPage,
  totalPages,
  sort,
  dir,
  ownerOptions,
  sourceOptions,
  countryOptions,
  planOptions,
  bandOptions,
  stageOptions,
  exportHref,
  href,
  currentFilters,
  kpis,
  funnel,
  openValue,
}: {
  rows: LeadRowLite[];
  allRowsCount: number;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  sort: string;
  dir: string;
  ownerOptions: { email: string; name: string }[];
  sourceOptions: string[];
  countryOptions: string[];
  planOptions: string[];
  bandOptions: string[];
  stageOptions: { value: string; label: string }[];
  exportHref: string;
  href: (patch: Record<string, string>) => string;
  currentFilters: {
    q: string;
    stage: string;
    source: string;
    country: string;
    plan: string;
    band: string;
    owner: string;
  };
  kpis: LeadsKpiData;
  funnel: FunnelItem[];
  openValue: { currency: string; value: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // Load hidden columns once on mount (localStorage).
  useEffect(() => setHiddenCols(loadHidden()), []);

  const toggleCol = (col: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      try {
        localStorage.setItem(COLUMN_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

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

  const filterState: LeadFilterState = {
    q: currentFilters.q,
    stage: currentFilters.stage || "all",
    source: currentFilters.source || "all",
    country: currentFilters.country,
    plan: currentFilters.plan,
    band: currentFilters.band || "all",
    owner: currentFilters.owner,
  };

  const pageHref = (p: number) => {
    const merged = new URLSearchParams(sp.toString());
    merged.set("page", String(p));
    return `${pathname}?${merged.toString()}`;
  };

  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);

  const hide = (col: string) => hiddenCols.has(col);

  return (
    <div className="space-y-5">
      {/* Header — real mission statement + actions */}
      <PageHeader
        title="Leads"
        subtitle="Every form, demo request, and inbound inquiry is captured automatically. Track your pipeline from first touch to closed deal."
        actions={
          <>
            <button className={btnGhost} onClick={() => setShowNew(true)}>+ New lead</button>
            <a className={btnGhost} href={exportHref}>Export CSV</a>
          </>
        }
      />

      {/* KPI strip — real numbers from backend */}
      <LeadsKpis kpis={kpis} openValue={openValue} href={href} />

      {/* Funnel — stage distribution */}
      {funnel.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pipeline</p>
          <FunnelStrip items={funnel} href={href} />
        </div>
      )}

      {/* Saved views + filter controls */}
      <SavedViews />
      <div className="flex flex-wrap items-center gap-3">
        <LeadFilters
          current={filterState}
          options={{
            sourceOptions,
            countryOptions,
            planOptions,
            bandOptions,
            stageOptions,
            ownerOptions,
          }}
          href={href}
        />

        {/* Column customization */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setColMenuOpen((o) => !o)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-zinc-600 shadow-sm transition hover:bg-surface-subtle md:min-h-9 dark:text-zinc-300"
            aria-haspopup="menu"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            Columns
          </button>
          {colMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setColMenuOpen(false)} />
              <div className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-line bg-surface p-2 shadow-lg">
                {ALL_COLUMNS.map((col) => (
                  <label key={col} className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <input
                      type="checkbox"
                      checked={!hiddenCols.has(col)}
                      onChange={() => toggleCol(col)}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    {COLUMN_LABELS[col]}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Per page */}
        <div className="flex items-center gap-2 text-xs">
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

      {/* Bulk stage bar */}
      {selected.size > 0 && (
        <BulkStageBar selected={[...selected]} onDone={() => setSelected(new Set())} ownerOptions={ownerOptions} />
      )}

      {/* Table */}
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
                <ThSort label="Property" field="name" sort={sort} dir={dir} />
                <th className="py-2.5 pr-3 font-semibold">Stage</th>
                {!hide("country") && <th className="py-2.5 pr-3 font-semibold">Country</th>}
                {!hide("plan") && <th className="py-2.5 pr-3 font-semibold">Plan</th>}
                {!hide("source") && <th className="py-2.5 pr-3 font-semibold">Source</th>}
                {!hide("value") && <th className="py-2.5 pr-3 font-semibold">Value</th>}
                {!hide("followup") && <th className="py-2.5 pr-3 font-semibold">Follow-up</th>}
                {!hide("owner") && <th className="py-2.5 pr-3 font-semibold">Owner</th>}
                {!hide("score") && <ThSort label="Score" field="score" sort={sort} dir={dir} align="right" />}
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

      {/* Pagination — proper range text */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {total === 0 ? "No results" : `${pageStart}–${pageEnd} of ${total}`}
          {total < allRowsCount && (
            <span> (filtered from {allRowsCount})</span>
          )}
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
