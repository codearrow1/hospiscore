"use client";

import { useMemo, useState, type DragEvent } from "react";
import {
  ACTIVE_STAGES,
  STAGE_DOT,
  STAGE_LABELS,
  STAGE_ORDER,
  canMove,
} from "@/lib/marketing/stages";
import { formatMoney } from "@/lib/format";
import {
  groupByStage,
  isOutcomeStage,
  stageTotals,
  type PipelineDeal,
} from "@/lib/marketing/pipeline";
import PipelineCard, { type PipelineCardActions } from "./PipelineCard";

const EMPTY_HINTS: Record<string, string> = {
  new: "Form and demo submissions land here.",
  qualified: "Score ≥ 40 or manually qualify.",
  contacted: "Log the first email or call.",
  demo_booked: "Book a demo from a lead.",
  demo_completed: "Mark demos completed after the call.",
  trial: "Trials started by sales appear here.",
  proposal: "Send pricing to move deals in.",
  negotiation: "Late-stage deals being worked.",
};

function ColumnHeaderTotal({ deals }: { deals: PipelineDeal[] }) {
  const byCurrency = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of deals) {
      const cur = (d.estimatedValueCurrency ?? "USD").toUpperCase();
      out[cur] = (out[cur] ?? 0) + (d.estimatedValue ?? 0);
    }
    return Object.entries(out).filter(([, v]) => v > 0);
  }, [deals]);
  if (byCurrency.length === 0) return null;
  return (
    <div className="mb-2 truncate px-1 text-[10px] font-semibold tabular-nums text-zinc-400">
      {byCurrency.map(([cur, v], i) => (
        <span key={cur}>
          {i > 0 && <span aria-hidden="true"> + </span>}
          {formatMoney(v, cur)}
        </span>
      ))}
    </div>
  );
}

function BoardColumn({
  stage,
  deals,
  canEdit,
  canManage,
  busyIds,
  now,
  actions,
  isValidTarget,
  onDrop,
  dragOver,
  setDragOver,
}: {
  stage: (typeof STAGE_ORDER)[number];
  deals: PipelineDeal[];
  canEdit: boolean;
  canManage: boolean;
  busyIds: Set<string>;
  now: number;
  actions: PipelineCardActions;
  isValidTarget: (dealId: string, to: (typeof STAGE_ORDER)[number]) => boolean;
  onDrop: (dealId: string, to: (typeof STAGE_ORDER)[number]) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
}) {
  const hasStale = deals.some((d) => d.stale);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id && isValidTarget(id, stage)) onDrop(id, stage);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const id = e.dataTransfer.getData("text/plain");
        setDragOver(!!id && isValidTarget(id, stage));
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={handleDrop}
      className={`flex w-[270px] shrink-0 snap-start flex-col rounded-2xl border bg-zinc-50/70 p-2.5 transition dark:bg-zinc-900/50 ${
        dragOver
          ? "border-indigo-400 ring-2 ring-indigo-200 dark:border-indigo-600 dark:ring-indigo-900"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[stage]}`} />
          <span className="truncate text-xs font-bold text-zinc-700 dark:text-zinc-200">
            {STAGE_LABELS[stage]}
          </span>
          {hasStale && !isOutcomeStage(stage) && (
            <span aria-hidden="true" title="Contains stale deals" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
          )}
        </div>
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {deals.length}
        </span>
      </div>
      {!isOutcomeStage(stage) && <ColumnHeaderTotal deals={deals} />}
      <div className="space-y-2">
        {deals.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 px-2.5 py-5 text-center text-[11px] leading-snug text-zinc-400 dark:border-zinc-700">
            {EMPTY_HINTS[stage] ?? ""}
          </p>
        )}
        {deals.map((deal) => (
          <PipelineCard
            key={deal.id}
            deal={deal}
            actions={actions}
            canEdit={canEdit}
            canManage={canManage}
            busy={busyIds.has(deal.id)}
            now={now}
            onDragStart={(e, d) => {
              e.dataTransfer.setData("text/plain", d.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function PipelineKanban({
  deals,
  canEdit,
  canManage,
  busyIds,
  now,
  actions,
  showOutcomes,
  onToggleOutcomes,
}: {
  deals: PipelineDeal[];
  canEdit: boolean;
  canManage: boolean;
  busyIds: Set<string>;
  now: number;
  actions: PipelineCardActions;
  showOutcomes: boolean;
  onToggleOutcomes: () => void;
}) {
  const groups = useMemo(() => groupByStage(deals), [deals]);
  const totals = useMemo(() => stageTotals(deals), [deals]);
  const [mobileStage, setMobileStage] = useState<"all" | (typeof STAGE_ORDER)[number]>("all");
  const [dragOverStage, setDragOverStage] = useState<PipelineDeal["stage"] | null>(null);

  const isValidTarget = (dealId: string, to: PipelineDeal["stage"]) => {
    const d = deals.find((x) => x.id === dealId);
    return Boolean(d && d.stage !== to && canMove(d.stage, to) && !busyIds.has(dealId));
  };

  const handleDrop = (dealId: string, to: PipelineDeal["stage"]) => {
    const dragging = deals.find((d) => d.id === dealId);
    setDragOverStage(null);
    if (!dragging || dragging.stage === to || !canMove(dragging.stage, to)) return;
    if (busyIds.has(dealId)) return;
    actions.onMove(dragging, to);
  };

  const columnProps = (s: (typeof STAGE_ORDER)[number]) => ({
    stage: s,
    deals: groups[s] ?? [],
    canEdit,
    canManage,
    busyIds,
    now,
    actions,
    isValidTarget,
    onDrop: handleDrop,
    dragOver: dragOverStage === s,
    setDragOver: (v: boolean) => setDragOverStage(v ? s : null),
  });

  const activeColumns = ACTIVE_STAGES.map((s) => <BoardColumn key={s} {...columnProps(s)} />);
  const mobileColumnsVisible = mobileStage === "all" ? ACTIVE_STAGES : [mobileStage];

  const won = groups.won ?? [];
  const lost = groups.lost ?? [];
  const wonTotal = Object.entries(totals.won.byCurrency).filter(([, v]) => v > 0);

  return (
    <div className="space-y-4">
      {/* Mobile: one stage at a time instead of ten narrow rails. */}
      <div className="flex items-center gap-2 lg:hidden">
        <label className="text-xs font-semibold text-zinc-500" htmlFor="mobile-stage">
          Showing
        </label>
        <select
          id="mobile-stage"
          value={mobileStage}
          onChange={(e) => setMobileStage(e.target.value as typeof mobileStage)}
          className="min-h-9 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-700 outline-none focus:border-indigo-400 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="all">All active stages (stacked)</option>
          {ACTIVE_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile stacked columns */}
      <div className="w-full space-y-3 sm:w-auto lg:hidden">
        {mobileColumnsVisible.map((s) => (
          <BoardColumn key={s} {...columnProps(s)} />
        ))}
      </div>

      {/* Desktop horizontal rail */}
      <div className="hidden gap-3 overflow-x-auto pb-2 lg:flex">{activeColumns}</div>

      {showOutcomes && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Outcomes</h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {won.length} won · {lost.length} lost — closed deals, elsewhere in reporting too.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleOutcomes}
              className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-zinc-500 transition hover:bg-surface-subtle dark:text-zinc-300"
            >
              Collapse
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STAGE_DOT.won}`} />
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">Won</span>
                </span>
                {wonTotal.length > 0 && (
                  <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {wonTotal.map(([cur, v], i) => (
                      <span key={cur}>
                        {i > 0 && <span aria-hidden="true"> + </span>}
                        {formatMoney(v, cur)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              {won.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 px-2.5 py-5 text-center text-[11px] text-zinc-400 dark:border-zinc-700">
                  No closed deals yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {won.map((d) => (
                    <li key={d.id} className="rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        <a
                          href={`/marketing-admin/leads/${d.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {d.name}
                        </a>
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {d.estimatedValue > 0 ? formatMoney(d.estimatedValue, d.estimatedValueCurrency) : "—"} · closed{" "}
                        {d.updatedAt
                          ? new Date(d.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STAGE_DOT.lost}`} />
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">Lost</span>
                {lost.length > 0 && <span className="text-[10px] text-zinc-400">({lost.length})</span>}
              </div>
              {lost.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 px-2.5 py-5 text-center text-[11px] text-zinc-400 dark:border-zinc-700">
                  Nothing lost here yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lost.map((d) => (
                    <li key={d.id} className="rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        <a
                          href={`/marketing-admin/leads/${d.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {d.name}
                        </a>
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {d.lostReason ? d.lostReason.replace(/_/g, " ") : "reason not set"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}