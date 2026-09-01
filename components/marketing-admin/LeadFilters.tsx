"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FilterSheet, Field, Select } from "@/components/ui/index";
import { FilterChipLink } from "./LeadTable";

export interface LeadFilterState {
  q: string;
  stage: string;
  source: string;
  country: string;
  plan: string;
  band: string;
  owner: string;
}

export interface LeadFilterOptions {
  sourceOptions: string[];
  countryOptions: string[];
  planOptions: string[];
  bandOptions: string[];
  stageOptions: { value: string; label: string }[];
  ownerOptions: { email: string; name: string }[];
}

export function activeFilterCount(f: LeadFilterState): number {
  let n = 0;
  if (f.q) n += 1;
  if (f.stage && f.stage !== "all") n += 1;
  if (f.source && f.source !== "all") n += 1;
  if (f.country) n += 1;
  if (f.plan) n += 1;
  if (f.band && f.band !== "all") n += 1;
  if (f.owner) n += 1;
  return n;
}

export function LeadFilters({
  current,
  options,
  href,
}: {
  current: LeadFilterState;
  options: LeadFilterOptions;
  href: (patch: Record<string, string>) => string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<LeadFilterState>(current);

  // Re-seed draft when filters change in the URL (only on navigation).
  useEffect(() => {
    setDraft(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.q, current.stage, current.source, current.country, current.plan, current.band, current.owner]);

  const set = (patch: Partial<LeadFilterState>) => setDraft((d) => ({ ...d, ...patch }));

  const apply = (next: LeadFilterState) => {
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.stage && next.stage !== "all") p.set("stage", next.stage);
    if (next.source && next.source !== "all") p.set("source", next.source);
    if (next.country) p.set("country", next.country);
    if (next.plan) p.set("plan", next.plan);
    if (next.band && next.band !== "all") p.set("band", next.band);
    if (next.owner) p.set("owner", next.owner);
    router.push(p.toString() ? `${pathname}?${p.toString()}` : pathname);
  };

  const clearAll = () => {
    const empty: LeadFilterState = { q: "", stage: "all", source: "all", country: "", plan: "", band: "all", owner: "" };
    setDraft(empty);
    router.push(pathname);
  };

  const activeChips: { key: string; label: string; patch: Record<string, string> }[] = [];
  if (current.q) activeChips.push({ key: "q", label: `Search: “${current.q}”`, patch: { q: "" } });
  if (current.stage && current.stage !== "all") activeChips.push({ key: "stage", label: `Stage: ${current.stage.replace(/_/g, " ")}`, patch: { stage: "all" } });
  if (current.source && current.source !== "all") activeChips.push({ key: "source", label: `Source: ${current.source.replace(/_/g, " ")}`, patch: { source: "all" } });
  if (current.country) activeChips.push({ key: "country", label: `Country: ${current.country}`, patch: { country: "" } });
  if (current.plan) activeChips.push({ key: "plan", label: `Plan: ${current.plan}`, patch: { plan: "" } });
  if (current.band && current.band !== "all") activeChips.push({ key: "band", label: `Band: ${current.band.replace(/_/g, " ")}`, patch: { band: "all" } });
  if (current.owner) {
    const ownerLabel = options.ownerOptions.find((o) => o.email === current.owner)?.name || current.owner;
    activeChips.push({ key: "owner", label: `Owner: ${ownerLabel}`, patch: { owner: "" } });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {activeChips.length === 0 ? (
          <FilterChipLink href={href({})} label="All leads" active />
        ) : (
          activeChips.map((c) => (
            <FilterChipLink key={c.key} href={href(c.patch)} label={c.label} active onRemove={(e) => {
              e.preventDefault();
              router.push(href(c.patch));
            }} />
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
            placeholder="Name, email, property, country…"
            className="w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-indigo-400"
          />
        </Field>
        <Field label="Stage">
          <Select value={draft.stage} onChange={(e) => set({ stage: e.target.value })} className="w-full">
            <option value="all">All stages</option>
            {options.stageOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Source">
          <Select value={draft.source} onChange={(e) => set({ source: e.target.value })} className="w-full">
            <option value="all">All sources</option>
            {options.sourceOptions.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Band">
          <Select value={draft.band} onChange={(e) => set({ band: e.target.value })} className="w-full">
            <option value="all">All bands</option>
            {options.bandOptions.map((b) => (
              <option key={b} value={b}>{b.replace(/_/g, " ")}</option>
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
        <Field label="Country">
          <Select value={draft.country} onChange={(e) => set({ country: e.target.value })} className="w-full">
            <option value="">Any country</option>
            {options.countryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Plan interest">
          <Select value={draft.plan} onChange={(e) => set({ plan: e.target.value })} className="w-full">
            <option value="">Any plan</option>
            {options.planOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </Field>
      </FilterSheet>
    </div>
  );
}
