"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  canMove,
  isLeadStage,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  type Priority,
} from "@/lib/marketing/stages";
import { formatMoney, formatRelative } from "@/lib/format";
import type { PipelineDeal } from "@/lib/marketing/pipeline";

export interface PipelineCardActions {
  onMove: (deal: PipelineDeal, to: PipelineDeal["stage"]) => void;
  onPriority: (id: string, p: Priority | undefined) => void;
  onFollowUp: (deal: PipelineDeal) => void;
  onAssign: (deal: PipelineDeal) => void;
  onDelete: (deal: PipelineDeal) => void;
}

export function PriorityPill({ priority }: { priority?: Priority }) {
  if (!priority) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[priority]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/* ------------------------------------------------------------- kebab -- */

function MenuItem({
  onSelect,
  danger = false,
  children,
}: {
  onSelect: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-zinc-700 hover:bg-surface-subtle dark:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1.5 h-px bg-zinc-100 dark:bg-zinc-800" />;
}

export function KebabMenu({
  deal,
  actions,
  canEdit,
  canManage,
}: {
  deal: PipelineDeal;
  actions: PipelineCardActions;
  canEdit: boolean;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const moves = STAGE_ORDER.filter((s) => canMove(deal.stage, s));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${deal.name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-surface-subtle hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-xl"
        >
          <MenuItem onSelect={() => setOpen(false)}>
            <span aria-hidden="true" className="text-zinc-400">↗</span>
            <Link href={`/marketing-admin/leads/${deal.id}`} className="flex-1">
              Open deal
            </Link>
          </MenuItem>
          {canEdit && (
            <>
              {moves.length > 0 && (
                <>
                  <MenuDivider />
                  <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Move to</p>
                  {moves.map((s) => (
                    <MenuItem
                      key={s}
                      onSelect={() => {
                        setOpen(false);
                        actions.onMove(deal, s);
                      }}
                    >
                      {s === deal.stage ? "Current" : STAGE_LABELS[s]}
                    </MenuItem>
                  ))}
                </>
              )}
              <MenuDivider />
              <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Priority</p>
              <div className="flex items-center gap-1 px-3 py-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={deal.priority === p}
                    onClick={() => {
                      setOpen(false);
                      actions.onPriority(deal.id, deal.priority === p ? undefined : p);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                      deal.priority === p ? PRIORITY_STYLES[p] : "text-zinc-500 hover:bg-surface-subtle"
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
              <MenuItem onSelect={() => { setOpen(false); actions.onFollowUp(deal); }}>
                <span aria-hidden="true" className="text-zinc-400">↻</span> Follow-up
              </MenuItem>
              <MenuItem onSelect={() => { setOpen(false); actions.onAssign(deal); }}>
                <span aria-hidden="true" className="text-zinc-400">→</span> Assign owner
              </MenuItem>
            </>
          )}
          {canManage && (
            <>
              <MenuDivider />
              <MenuItem danger onSelect={() => { setOpen(false); actions.onDelete(deal); }}>
                Delete…
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- card --- */

export default function PipelineCard({
  deal,
  actions,
  canEdit,
  canManage,
  busy,
  now,
  onDragStart,
  onDragEnd,
}: {
  deal: PipelineDeal;
  actions: PipelineCardActions;
  canEdit: boolean;
  canManage: boolean;
  busy: boolean;
  now: number;
  onDragStart?: (e: DragEvent<HTMLDivElement>, deal: PipelineDeal) => void;
  onDragEnd?: () => void;
}) {
  const org = deal.company || deal.propertyName || deal.city || undefined;
  const followDate = deal.nextFollowUpAt
    ? new Date(deal.nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const followChip = deal.followUpStatus === "none" ? null : (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
        deal.followUpStatus === "overdue"
          ? "text-red-600 dark:text-red-400"
          : deal.followUpStatus === "due"
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      ↻ {followDate}
      {deal.followUpStatus === "overdue" ? " · overdue" : deal.followUpStatus === "due" ? " · due" : ""}
    </span>
  );

  const staleChip = deal.stale ? (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
      Stale
    </span>
  ) : null;

  const draggable = Boolean(canEdit && !busy && onDragStart);

  /** Don't hijack pointer interactions with drags on controls. */
  const isControl = (e: DragEvent<HTMLDivElement>) =>
    Boolean((e.target as Element).closest?.("button, select, input, a, textarea"));

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (isControl(e)) {
          e.preventDefault();
          return;
        }
        onDragStart?.(e, deal);
      }}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col gap-1.5 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 ${
        busy ? "pointer-events-none opacity-55" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-start gap-1.5">
          <div className="min-w-0">
            <Link
              href={`/marketing-admin/leads/${deal.id}`}
              className="block truncate align-middle text-sm font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
            >
              {deal.name}
            </Link>
            {org && <p className="mt-0.5 truncate text-[11px] text-zinc-400">{org}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {deal.priority && <PriorityPill priority={deal.priority} />}
          <KebabMenu deal={deal} actions={actions} canEdit={canEdit} canManage={canManage} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`text-xs font-semibold tabular-nums ${
            deal.estimatedValue > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-zinc-300 dark:text-zinc-600"
          }`}
        >
          {deal.estimatedValue > 0 ? formatMoney(deal.estimatedValue, deal.estimatedValueCurrency) : "—"}
        </span>
        {deal.planInterest && (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            {deal.planInterest}
            {deal.billingCycle ? ` · ${deal.billingCycle}` : ""}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            deal.score >= 70
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              : deal.score >= 40
                ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                : deal.score >= 20
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {deal.score} · {deal.band.replace("_", " ")}
        </span>
        {staleChip}
        {followChip}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-zinc-100 pt-1.5 dark:border-zinc-800">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            aria-hidden="true"
          >
            {(deal.ownerName ?? deal.ownerEmail ?? "U").slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
            {deal.ownerName ?? deal.ownerEmail ?? "unassigned"}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-zinc-400">
          {deal.daysInStage}d · {formatRelative(deal.updatedAt, new Date(now))}
        </span>
      </div>

      {canEdit && (
        <select
          value={deal.stage}
          disabled={busy}
          aria-label={`Move ${deal.name}`}
          onChange={(e) => {
            const to = e.target.value;
            if (isLeadStage(to) && to !== deal.stage) actions.onMove(deal, to);
            else e.target.value = deal.stage;
          }}
          className="mt-0.5 w-full rounded-md border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[10px] text-zinc-600 outline-none focus:border-indigo-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value={deal.stage}>{STAGE_LABELS[deal.stage]}</option>
          {STAGE_ORDER.filter((s) => canMove(deal.stage, s)).map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}