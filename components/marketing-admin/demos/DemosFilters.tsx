"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FilterSheet, Field, Select } from "@/components/ui/index";
import { FilterChipLink } from "@/components/marketing-admin/LeadTable";

export interface DemosFilterState {
  q: string;
  status: string;
  owner: string;
  period: string;
  country: string;
  stage: string;
  source: string;
  demoType: string;
  followUp: string;
}

export interface DemosFilterOptions {
  ownerOptions: { email: string; name: string }[];
  statuses: { value: string; label: string }[];
  stageOptions: { value: string; label: string }[];
  sourceOptions: string[];
  countryOptions: string[];
  demoTypeOptions: string[];
  periods: { value: string; label: string }[];
}

export function activeFilterCount(f: DemosFilterState): number {
  let n = 0;
  if (f.q) n += 1;
  if (f.status) n += 1;
  if (f.owner) n += 1;
  if (f.period) n += 1;
  if (f.country) n += 1;
  if (f.stage) n += 1;
  if (f.source) n += 1;
  if (f.demoType) n += 1;
  if (f.followUp === "1") n += 1;
  return n;
}

const EMPTY: DemosFilterState = {
  q: "",
  status: "",
  owner: "",
  period: "",
  country: "",
  stage: "",
  source: "",
  demoType: "",
  followUp: "",
};

export function DemosFilters({
  current,
  options,
  href,
}: {
  current: DemosFilterState;
  options: DemosFilterOptions;
  href: (patch: Record<string, string | undefined>) => string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<DemosFilterState>(current);

  useEffect(() => {
    setDraft(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.q, current.status, current.owner, current.period, current.country, current.stage, current.source, current.demoType, current.followUp]);

  const set = (patch: Partial<DemosFilterState>) => setDraft((d) => ({ ...d, ...patch }));

  const apply = (next: DemosFilterState) => {
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.status) p.set("status", next.status);
    if (next.owner) p.set("owner", next.owner);
    if (next.period) p.set("period", next.period);
    if (next.country) p.set("country", next.country);
    if (next.stage) p.set("stage", next.stage);
    if (next.source) p.set("source", next.source);
    if (next.demoType) p.set("demoType", next.demoType);
    if (next.followUp === "1") p.set("followUp", "1");
    router.push(p.toString() ? `${pathname}?${p.toString()}` : pathname);
  };

  const clearAll = () => {
    setDraft(EMPTY);
    router.push(pathname);
  };

  const ownerLabel = (email: string) => options.ownerOptions.find((o) => o.email === email)?.name || email;
  const periodLabel = (v: string) => options.periods.find((p) => p.value === v)?.label || v;

  const activeChips: { key: string; label: string; patch: Record<string, string> }[] = [];
  if (current.q) activeChips.push({ key: "q", label: `Search: “${current.q}”`, patch: { q: "" } });
  if (current.status) activeChips.push({ key: "status", label: `Status: ${current.status.replace(/_/g, " ")}`, patch: { status: "" } });
  if (current.period) activeChips.push({ key: "period", label: `When: ${periodLabel(current.period)}`, patch: { period: "" } });
  if (current.followUp === "1") activeChips.push({ key: "followUp", label: "Needs follow-up", patch: { followUp: "" } });
  if (current.owner) activeChips.push({ key: "owner", label: `Owner: ${ownerLabel(current.owner)}`, patch: { owner: "" } });
  if (current.stage) activeChips.push({ key: "stage", label: `Stage: ${current.stage.replace(/_/g, " ")}`, patch: { stage: "" } });
  if (current.source) activeChips.push({ key: "source", label: `Source: ${current.source.replace(/_/g, " ")}`, patch: { source: "" } });
  if (current.country) activeChips.push({ key: "country", label: `Country: ${current.country}`, patch: { country: "" } });
  if (current.demoType) activeChips.push({ key: "demoType", label: `Type: ${current.demoType}`, patch: { demoType: "" } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {activeChips.length === 0 ? (
          <FilterChipLink href={href({})} label="All demos" active />
        ) : (
          activeChips.map((c) => (
            <FilterChipLink
              key={c.key}
              href={href(c.patch)}
              label={c.label}
              active
              onRemove={(e) => {
                e.preventDefault();
                router.push(href(c.patch));
              }}
            />
          ))
        )}
      </div>

      <FilterSheet
        label="Filters"
        activeCount={activeFilterCount(current)}
        onClearAll={clearAll}
        footerExtra={
          <button
            type="button"
            onClick={() => apply(draft)}
            className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 md:min-h-9"
          >
            Apply filters
          </button>
        }
      >
        <Field label="Search">
          <input
            value={draft.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Name, email, property, city…"
            className="w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-indigo-400"
          />
        </Field>
        <Field label="When">
          <Select value={draft.period} onChange={(e) => set({ period: e.target.value })} className="w-full">
            <option value="">Any time</option>
            {options.periods.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set({ status: e.target.value })} className="w-full">
            <option value="">All statuses</option>
            {options.statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Pipeline stage">
          <Select value={draft.stage} onChange={(e) => set({ stage: e.target.value })} className="w-full">
            <option value="">All stages</option>
            {options.stageOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={draft.owner} onChange={(e) => set({ owner: e.target.value })} className="w-full">
            <option value="">Any owner</option>
            <option value="__none__">— Unassigned —</option>
            {options.ownerOptions.map((o) => (
              <option key={o.email} value={o.email}>{o.name || o.email}</option>
            ))}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={draft.source} onChange={(e) => set({ source: e.target.value })} className="w-full">
            <option value="">All sources</option>
            {options.sourceOptions.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Demo type">
          <Select value={draft.demoType} onChange={(e) => set({ demoType: e.target.value })} className="w-full">
            <option value="">All types</option>
            {options.demoTypeOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Country">
          <Select value={draft.country} onChange={(e) => set({ country: e.target.value })} className="w-full">
            <option value="">Any country</option>
            {options.countryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </FilterSheet>
    </div>
  );
}