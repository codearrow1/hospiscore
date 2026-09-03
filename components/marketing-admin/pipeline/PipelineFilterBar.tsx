"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilterSheet, Field, Select } from "@/components/ui/index";
import { inputCls } from "@/components/ui/Field";
import {
  ACTIVE_STAGES,
  OUTCOME_STAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
} from "@/lib/marketing/stages";
import {
  activeFilterCount,
  emptyFilters,
  type PipelineFilters,
} from "@/lib/marketing/pipeline";
import type { PipelineSortField, SortDir } from "./PipelineTableList";

export type PipelineView = "kanban" | "list" | "table";

export interface SavedView {
  name: string;
  filters: PipelineFilters;
  view: PipelineView;
}

const VIEWS: { value: PipelineView; label: string }[] = [
  { value: "kanban", label: "Kanban" },
  { value: "list", label: "List" },
  { value: "table", label: "Table" },
];

export default function PipelineFilterBar({
  filters,
  onChange,
  ownersUsed,
  sourcesUsed,
  currenciesUsed,
  demoCount,
  demoDefaultExclude,
  view,
  onView,
  sortField,
  sortDir,
  onSort,
  onClearAll,
}: {
  filters: PipelineFilters;
  onChange: (f: PipelineFilters) => void;
  ownersUsed: { email: string; name: string }[];
  sourcesUsed: string[];
  currenciesUsed: string[];
  demoCount: number;
  demoDefaultExclude: boolean;
  view: PipelineView;
  onView: (v: PipelineView) => void;
  sortField: PipelineSortField;
  sortDir: SortDir;
  onSort: (f: PipelineSortField, d: SortDir) => void;
  onClearAll: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(filters.q ?? "");
  const [saveName, setSaveName] = useState("");
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("marketing.pipelineViews") ?? "[]") as SavedView[];
    } catch {
      return [];
    }
  });

  // Keep the box in sync with external changes (e.g. a saved view restore).
  useEffect(() => {
    setSearch(filters.q ?? "");
  }, [filters.q]);

  // Debounced search — merges against the LATEST filters so rapid
  // interactions elsewhere never clobber each other.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== filtersRef.current.q) {
        onChange({ ...filtersRef.current, q: search });
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // "/" focuses search from anywhere on the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = (patch: Partial<PipelineFilters>) => onChange({ ...filters, ...patch });

  const count = activeFilterCount({ ...filters, q: "" });

  const demoToggled = demoDefaultExclude;
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.owner) {
    const o = ownersUsed.find((x) => x.email === filters.owner);
    chips.push({ key: "owner", label: `Owner: ${filters.owner === "__none__" ? "unassigned" : o?.name ?? o?.email ?? filters.owner}`, clear: () => set({ owner: "" }) });
  }
  const stageChips = (filters.stages ?? []).map((s) => STAGE_LABELS[s]);
  if (stageChips.length > 0 && stageChips.length < 10)
    chips.push({ key: "stages", label: `Stages: ${stageChips.join(", ")}`, clear: () => set({ stages: [] }) });
  if (filters.priority && filters.priority !== "any")
    chips.push({ key: "priority", label: `Priority: ${filters.priority === "none" ? "not set" : PRIORITY_LABELS[filters.priority]}`, clear: () => set({ priority: "any" }) });
  if (filters.currency)
    chips.push({ key: "currency", label: `Currency: ${filters.currency}`, clear: () => set({ currency: undefined }) });
  if (typeof filters.valueMin === "number" || typeof filters.valueMax === "number")
    chips.push({ key: "value", label: "Value range", clear: () => set({ valueMin: undefined, valueMax: undefined }) });
  if (filters.staleOnly)
    chips.push({ key: "stale", label: "Stale only", clear: () => set({ staleOnly: false }) });
  if (filters.dueSoonOnly)
    chips.push({ key: "due", label: "Due soon", clear: () => set({ dueSoonOnly: false }) });
  if (typeof filters.minScore === "number")
    chips.push({ key: "score", label: `Score ≥ ${filters.minScore}`, clear: () => set({ minScore: undefined }) });
  if (filters.source)
    chips.push({ key: "source", label: `Source: ${filters.source.replace(/_/g, " ")}`, clear: () => set({ source: undefined }) });
  if (filters.createdFrom || filters.createdTo)
    chips.push({ key: "created", label: "Created range", clear: () => set({ createdFrom: undefined, createdTo: undefined }) });
  if (filters.touchesFrom)
    chips.push({ key: "touched", label: "Touched since", clear: () => set({ touchesFrom: undefined }) });

  const persistSaved = (next: SavedView[]) => {
    setSavedViews(next);
    try {
      localStorage.setItem("marketing.pipelineViews", JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const saveCurrentView = () => {
    const name = saveName.trim();
    if (!name) return;
    const next = [...savedViews.filter((v) => v.name !== name), { name, filters: { ...filters }, view }];
    persistSaved(next);
    setSaveName("");
  };

  const toggles: { key: keyof PipelineFilters; label: string }[] = [
    { key: "staleOnly", label: "Stale only (no touch ≥ 14 days)" },
    { key: "dueSoonOnly", label: "Next follow-up due ≤ 7 days" },
  ];

  const stageGroups: { label: string; stages: (typeof STAGE_ORDER)[number][] }[] = [
    { label: "Active", stages: [...ACTIVE_STAGES] },
    { label: "Outcomes", stages: [...OUTCOME_STAGES] },
  ];

  const selectedStages = useMemo(() => new Set(filters.stages ?? []), [filters.stages]);

  const toggleStage = (s: string) => {
    const next = new Set(selectedStages);
    if (next.has(s as never)) next.delete(s as never);
    else next.add(s as never);
    set({ stages: [...next] });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…  ( / )"
            aria-label="Search deals"
            className={`${inputCls} pl-9`}
          />
        </div>

        <FilterSheet
          activeCount={count}
          onClearAll={onClearAll}
          footerExtra={
            <span className="flex items-center gap-1.5">
              <input
                className={inputCls + " !min-h-8 !py-1.5 text-xs"}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="View name…"
                aria-label="Saved view name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCurrentView();
                }}
              />
              <button
                type="button"
                onClick={saveCurrentView}
                disabled={!saveName.trim()}
                className="inline-flex min-h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:text-zinc-300"
              >
                Save view
              </button>
            </span>
          }
        >
          <Field label="Owner">
            <Select value={filters.owner ?? ""} onChange={(e) => set({ owner: e.target.value })}>
              <option value="">Any owner</option>
              <option value="__none__">Unassigned</option>
              {ownersUsed.map((o) => (
                <option key={o.email} value={o.email}>
                  {o.name || o.email}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Stages">
            <div className="space-y-2">
              {stageGroups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{g.label}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {g.stages.map((s) => {
                      const checked = selectedStages.has(s);
                      return (
                        <label
                          key={s}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                            checked ? "border-indigo-400 bg-brand-soft text-brand dark:text-indigo-200" : "border-line hover:bg-surface-subtle"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStage(s)}
                            className="h-3.5 w-3.5 accent-indigo-600"
                          />
                          {STAGE_LABELS[s]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Priority">
            <Select value={filters.priority ?? "any"} onChange={(e) => set({ priority: e.target.value as PipelineFilters["priority"] })}>
              <option value="any">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
              <option value="none">Not set</option>
            </Select>
          </Field>

          <Field label="Estimated value">
            <div className="flex items-center gap-2">
              <Select value={filters.currency ?? ""} onChange={(e) => set({ currency: e.target.value || undefined })}>
                <option value="">Any currency</option>
                {currenciesUsed.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder="Min (whole units)"
                aria-label="Minimum value in whole units"
                value={typeof filters.valueMin === "number" ? String(filters.valueMin / 100) : ""}
                onChange={(e) => set({ valueMin: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined })}
              />
              <span className="text-zinc-400">–</span>
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder="Max (whole units)"
                aria-label="Maximum value in whole units"
                value={typeof filters.valueMax === "number" ? String(filters.valueMax / 100) : ""}
                onChange={(e) => set({ valueMax: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined })}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">Whole units of the selected currency, annual estimate.</p>
          </Field>

          <Field label="Status">
            <div className="space-y-1.5">
              {toggles.map((t) => (
                <label key={t.key} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={Boolean(filters[t.key])}
                    onChange={(e) => set({ [t.key]: e.target.checked } as Partial<PipelineFilters>)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Minimum score">
            <Select value={typeof filters.minScore === "number" ? String(filters.minScore) : ""} onChange={(e) => set({ minScore: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Any score</option>
              <option value="70">Very hot (≥ 70)</option>
              <option value="40">Hot (≥ 40)</option>
              <option value="20">Warm (≥ 20)</option>
            </Select>
          </Field>

          <Field label="Source">
            <Select value={filters.source ?? ""} onChange={(e) => set({ source: e.target.value || undefined })}>
              <option value="">Any source</option>
              {sourcesUsed.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Created from">
              <input className={inputCls} type="date" value={filters.createdFrom ?? ""} onChange={(e) => set({ createdFrom: e.target.value || undefined })} />
            </Field>
            <Field label="Created to">
              <input className={inputCls} type="date" value={filters.createdTo ?? ""} onChange={(e) => set({ createdTo: e.target.value || undefined })} />
            </Field>
          </div>

          <Field label="Last touched since">
            <input className={inputCls} type="date" value={filters.touchesFrom ?? ""} onChange={(e) => set({ touchesFrom: e.target.value || undefined })} />
          </Field>

          {demoCount > 0 && (
            <Field label="Development / test records">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={filters.demoExcluded ?? demoToggled}
                  onChange={(e) => set({ demoExcluded: e.target.checked })}
                  className="h-3.5 w-3.5 accent-indigo-600"
                />
                Exclude demo/test records ({demoCount})
              </label>
              <p className="mt-1 text-[11px] text-zinc-400">
                {demoDefaultExclude ? "Hidden by default in production." : "Demo/test records are visible in development."}
              </p>
            </Field>
          )}

          <Field label="Outcomes">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={filters.includeOutcomes !== false}
                onChange={(e) => set({ includeOutcomes: e.target.checked })}
                className="h-3.5 w-3.5 accent-indigo-600"
              />
              Show won and lost deals
            </label>
          </Field>

          {savedViews.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Saved views</p>
              <div className="flex flex-wrap gap-1.5">
                {savedViews.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => {
                      v.filters.demoExcluded = v.filters.demoExcluded ?? demoToggled;
                      onChange(v.filters);
                      onView(v.view);
                    }}
                    className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => persistSaved([])}
                className="mt-1 text-[11px] font-semibold text-zinc-400 hover:text-red-500"
              >
                Clear all saved views
              </button>
            </div>
          )}
        </FilterSheet>

        <div
          className="flex shrink-0 items-center rounded-xl border border-line bg-surface p-0.5 shadow-sm"
          role="tablist"
          aria-label="Pipeline view"
        >
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={view === v.value}
              onClick={() => onView(v.value)}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${
                view === v.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view !== "kanban" && (
          <div className="flex items-center gap-1.5">
            <span className="hidden text-xs font-semibold text-zinc-400 sm:inline">Sort</span>
            <select
              value={sortField}
              aria-label="Sort deals by"
              onChange={(e) => onSort(e.target.value as PipelineSortField, sortDir)}
              className="min-h-9 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-zinc-600 outline-none focus:border-indigo-400 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {[
                { value: "updatedAt", label: "Updated" },
                { value: "createdAt", label: "Created" },
                { value: "followUp", label: "Next follow-up" },
                { value: "value", label: "Value" },
                { value: "score", label: "Score" },
                { value: "name", label: "Name" },
                { value: "stage", label: "Stage" },
              ].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onSort(sortField, sortDir === "asc" ? "desc" : "asc")}
              aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-xs font-bold text-zinc-500 transition hover:bg-surface-subtle dark:text-zinc-300"
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        )}
      </div>

      {count + (search ? 1 : 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-red-200 hover:text-red-500 dark:text-zinc-300"
            >
              {c.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export { emptyFilters };