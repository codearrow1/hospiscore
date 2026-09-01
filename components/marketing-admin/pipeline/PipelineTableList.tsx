"use client";

import Link from "next/link";
import { STAGE_LABELS, STAGE_STYLES } from "@/lib/marketing/stages";
import { formatMoney, formatRelative } from "@/lib/format";
import {
  isOutcomeStage,
  sortPipelineDeals,
  type PipelineDeal,
  type PipelineSortField,
  type SortDir,
} from "@/lib/marketing/pipeline";
import { PriorityPill } from "./PipelineCard";

export type { PipelineSortField, SortDir };

export const SORT_OPTIONS: { value: PipelineSortField; label: string }[] = [
  { value: "updatedAt", label: "Recently updated" },
  { value: "createdAt", label: "Created" },
  { value: "followUp", label: "Next follow-up" },
  { value: "value", label: "Estimated value" },
  { value: "score", label: "Score" },
  { value: "name", label: "Name" },
  { value: "owner", label: "Owner" },
  { value: "stage", label: "Stage" },
];

export function SortControl({
  value,
  dir,
  onChange,
}: {
  value: PipelineSortField;
  dir: SortDir;
  onChange: (field: PipelineSortField, dir: SortDir) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        aria-label="Sort deals by"
        onChange={(e) => onChange(e.target.value as PipelineSortField, dir)}
        className="min-h-9 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-zinc-600 outline-none focus:border-indigo-400 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(value, dir === "asc" ? "desc" : "asc")}
        aria-label={dir === "asc" ? "Sort ascending" : "Sort descending"}
        title={dir === "asc" ? "Ascending" : "Descending"}
        className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-xs font-bold text-zinc-500 transition hover:bg-surface-subtle dark:text-zinc-300"
      >
        {dir === "asc" ? "↑" : "↓"}
      </button>
    </div>
  );
}

function useSorted(
  deals: readonly PipelineDeal[],
  field: PipelineSortField,
  dir: SortDir,
): PipelineDeal[] {
  return sortPipelineDeals(deals, field, dir);
}

export function PipelineList({
  deals,
  field,
  dir,
  now,
}: {
  deals: readonly PipelineDeal[];
  field: PipelineSortField;
  dir: SortDir;
  now: number;
}) {
  const rows = useSorted(deals, field, dir);
  return (
    <ul className="space-y-2">
      {rows.map((d) => (
        <li
          key={d.id}
          className="rounded-xl border border-line bg-surface p-3 shadow-sm transition hover:border-indigo-300 dark:hover:border-indigo-700"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href={`/marketing-admin/leads/${d.id}`}
                  className="truncate text-sm font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
                >
                  {d.name}
                </Link>
                {d.priority && <PriorityPill priority={d.priority} />}
              </div>
              <p className="truncate text-xs text-zinc-400">
                {d.email}
                {d.city && ` · ${d.city}`}
                {d.source && ` · ${d.source.replace(/_/g, " ")}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[d.stage]}`}
              >
                {STAGE_LABELS[d.stage]}
              </span>
              <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {d.estimatedValue > 0 ? formatMoney(d.estimatedValue, d.estimatedValueCurrency) : "—"}
              </span>
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            <span>{d.ownerName ?? d.ownerEmail ?? "Unassigned"}</span>
            {d.nextFollowUpAt && (
              <span className={d.followUpStatus === "overdue" ? "font-semibold text-red-600 dark:text-red-400" : d.followUpStatus === "due" ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                ↻ {new Date(d.nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {d.followUpStatus === "overdue"
                  ? " overdue"
                  : d.followUpStatus === "due"
                    ? " due"
                    : ""}
              </span>
            )}
            {d.stale && <span className="font-semibold text-amber-600 dark:text-amber-400">Stale</span>}
            <span className="ml-auto tabular-nums">
              {isOutcomeStage(d.stage) ? "closed" : `${d.daysInStage}d in stage`} ·{" "}
              {formatRelative(d.updatedAt, new Date(now))}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Th({
  label,
  field,
  current,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  field: PipelineSortField;
  current: PipelineSortField;
  dir: SortDir;
  onSort: (f: PipelineSortField, d: SortDir) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <th className={`px-3 py-2.5 ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field, active ? (dir === "asc" ? "desc" : "asc") : dir === "desc" ? "asc" : "desc")}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        {label}
        <span aria-hidden="true" className={active ? "text-indigo-600 dark:text-indigo-400" : "opacity-0"}>
          {active && dir === "asc" ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );
}

export function PipelineTable({
  deals,
  field,
  dir,
  onSort,
  now,
}: {
  deals: readonly PipelineDeal[];
  field: PipelineSortField;
  dir: SortDir;
  onSort: (f: PipelineSortField, d: SortDir) => void;
  now: number;
}) {
  const rows = useSorted(deals, field, dir);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead className="border-b border-line bg-surface-subtle">
          <tr>
            <Th label="Name" field="name" current={field} dir={dir} onSort={onSort} />
            <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Priority</th>
            <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Company / Property</th>
            <Th label="Stage" field="stage" current={field} dir={dir} onSort={onSort} className="hidden lg:table-cell" />
            <Th label="Value" field="value" current={field} dir={dir} onSort={onSort} />
            <Th label="Owner" field="owner" current={field} dir={dir} onSort={onSort} className="hidden md:table-cell" />
            <Th label="Score" field="score" current={field} dir={dir} onSort={onSort} />
            <th className="hidden px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-400 lg:table-cell">Follow-up</th>
            <Th label="Updated" field="updatedAt" current={field} dir={dir} onSort={onSort} className="hidden md:table-cell" />
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-zinc-100 transition last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40">
              <td className="px-3 py-2.5">
                <Link
                  href={`/marketing-admin/leads/${d.id}`}
                  className="block font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
                >
                  {d.name}
                </Link>
                <span className="block text-xs text-zinc-400">{d.email}</span>
              </td>
              <td className="px-3 py-2.5">
                <PriorityPill priority={d.priority} />
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                {d.company || d.propertyName || "—"}
              </td>
              <td className="hidden px-3 py-2.5 lg:table-cell">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[d.stage]}`}>
                  {STAGE_LABELS[d.stage]}
                </span>
              </td>
              <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {d.estimatedValue > 0 ? formatMoney(d.estimatedValue, d.estimatedValueCurrency) : "—"}
              </td>
              <td className="hidden max-w-[10rem] truncate px-3 py-2.5 text-xs text-zinc-500 md:table-cell">
                {d.ownerName ?? d.ownerEmail ?? <span className="text-zinc-300 dark:text-zinc-600">unassigned</span>}
              </td>
              <td className="px-3 py-2.5 text-sm tabular-nums">
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{d.score}</span>
                <span className="ml-1 text-[10px] uppercase text-zinc-400">{d.band.replace("_", " ")}</span>
              </td>
              <td className="hidden px-3 py-2.5 text-xs tabular-nums lg:table-cell">
                {d.nextFollowUpAt ? (
                  <span
                    className={
                      d.followUpStatus === "overdue"
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : d.followUpStatus === "due"
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-zinc-500"
                    }
                  >
                    {new Date(d.nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {d.followUpStatus === "overdue" ? " overdue" : d.followUpStatus === "due" ? " due" : ""}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-zinc-500 md:table-cell">
                {formatRelative(d.updatedAt, new Date(now))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}