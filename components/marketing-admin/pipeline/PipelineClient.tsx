"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FilteredEmptyState,
  PermissionNotice,
  useToast,
} from "@/components/ui/index";
import { formatMoney } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/marketing/stages";
import {
  applyPipelineFilters,
  emptyFilters,
  isOutcomeStage,
  toPipelineDeal,
  type PipelineDeal,
  type PipelineFilters,
} from "@/lib/marketing/pipeline";
import type { MarketingLead, LeadStage } from "@/lib/marketing/types";
import type { LostReason } from "@/lib/marketing/stages";
import PipelineKanban from "./PipelineKanban";
import { PipelineKpis } from "./PipelineKpis";
import PipelineFilterBar, { type PipelineView } from "./PipelineFilterBar";
import { PipelineList, PipelineTable, type PipelineSortField, type SortDir } from "./PipelineTableList";
import { LostReasonDialog } from "../LostReasonDialog";
import { AssignOwnerDialog, FollowUpDialog, ImportLeadsModal, NewDealModal } from "./modals";
import type { PipelineCardActions } from "./PipelineCard";

const iso = () => new Date().toISOString();

/** Re-derive a deal's stale/overdue/days after an optimistic patch. */
function recompute(d: PipelineDeal, nameByEmail: Map<string, string>, now: number): PipelineDeal {
  return toPipelineDeal(
    { ...d, notes: [], attribution: {} } as unknown as MarketingLead,
    nameByEmail,
    now,
  );
}

export interface PipelineSnapshot {
  deals: PipelineDeal[];
  users: { email: string; name: string }[];
  ownersUsed: { email: string; name: string }[];
  sourcesUsed: string[];
  currenciesUsed: string[];
  weights: Partial<Record<LeadStage, number>>;
  wonThisMonth: number;
  capabilities: string[];
  demoCount: number;
  demoDefaultExclude: boolean;
  initialStage?: LeadStage;
}

export default function PipelineClient({ snapshot }: { snapshot: PipelineSnapshot }) {
  const router = useRouter();
  const toast = useToast();
  const canEdit = snapshot.capabilities.includes("leads.write");
  const canManage = snapshot.capabilities.includes("leads.manage");

  const names = useMemo(
    () =>
      new Map<string, string>([
        ...snapshot.users.map((u) => [u.email.toLowerCase(), u.name] as const),
        ...snapshot.ownersUsed.map((o) => [o.email.toLowerCase(), o.name || o.email] as const),
      ]),
    [snapshot],
  );

  const [deals, setDeals] = useState<PipelineDeal[]>(snapshot.deals);
  const [filters, setFilters] = useState<PipelineFilters>(() => {
    const f = emptyFilters();
    f.demoExcluded = snapshot.demoDefaultExclude;
    if (snapshot.initialStage) f.stages = [snapshot.initialStage];
    return f;
  });
  const [view, setView] = useState<PipelineView>("kanban");
  const [sortField, setSortField] = useState<PipelineSortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [outcomesCollapsed, setOutcomesCollapsed] = useState(() => {
    try {
      return localStorage.getItem("marketing.pipeline.outcomesCollapsed") === "1";
    } catch {
      return false;
    }
  });

  const [dialog, setDialog] = useState<
    | { kind: "new" }
    | { kind: "import" }
    | { kind: "followup"; deal: PipelineDeal }
    | { kind: "assign"; deal: PipelineDeal }
    | { kind: "lost"; deal: PipelineDeal }
    | { kind: "won"; deal: PipelineDeal }
    | { kind: "delete"; deal: PipelineDeal }
    | null
  >(null);

  // Refs mirroring state so our imperative mutation flows never see stale data.
  const dealsRef = useRef(deals);
  const busyRef = useRef(busyIds);
  const nowRef = useRef(now);
  useEffect(() => void (dealsRef.current = deals), [deals]);
  useEffect(() => void (busyRef.current = busyIds), [busyIds]);
  useEffect(() => void (nowRef.current = now), [now]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const toggleOutcomes = useCallback(() => {
    setOutcomesCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("marketing.pipeline.outcomesCollapsed", next ? "1" : "0");
      } catch {
        /* ignored */
      }
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    const f = emptyFilters();
    f.demoExcluded = snapshot.demoDefaultExclude;
    setFilters(f);
  }, [snapshot.demoDefaultExclude]);

  const boardDeals = useMemo(() => {
    const visible = applyPipelineFilters(deals, filters, now);
    if (filters.includeOutcomes === false) return visible.filter((d) => !isOutcomeStage(d.stage));
    return visible;
  }, [deals, filters, now]);

  const activeDeals = useMemo(
    () => deals.filter((d) => !isOutcomeStage(d.stage) && !d.isDemo),
    [deals],
  );
  const activeValueByCurrency = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of activeDeals) {
      const cur = (d.estimatedValueCurrency ?? "USD").toUpperCase();
      out[cur] = (out[cur] ?? 0) + (d.estimatedValue ?? 0);
    }
    return Object.entries(out).filter(([, v]) => v > 0);
  }, [activeDeals]);

  const filtersActive = useMemo(() => {
    const f = emptyFilters();
    f.demoExcluded = snapshot.demoDefaultExclude;
    return JSON.stringify(f) !== JSON.stringify(filters);
  }, [filters, snapshot.demoDefaultExclude]);

  /* ----------------------------------------------- mutations ------ */

  const mutateOne = useCallback(
    async (
      id: string,
      makeOptimistic: (d: PipelineDeal) => PipelineDeal | "remove",
      request: () => Promise<Response>,
      onOk?: (res: Response, data: { lead?: MarketingLead }) => void,
    ) => {
      if (busyRef.current.has(id)) return;
      const prevRows = dealsRef.current;
      setBusyIds((s) => new Set(s).add(id));
      setDeals((rows) =>
        rows.flatMap((d) => {
          if (d.id !== id) return [d];
          const next = makeOptimistic(d);
          return next === "remove" ? [] : [recompute(next, names, nowRef.current)];
        }),
      );
      let res: Response;
      try {
        res = await request();
      } catch {
        setDeals(prevRows);
        setBusyIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        toast.error("Network error — your change was reverted");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { lead?: MarketingLead; ok?: boolean };
      if (!res.ok) {
        setDeals(prevRows);
        toast.error((data as { error?: string }).error ?? "Could not save change");
      } else if (data.lead) {
        setDeals((rows) =>
          rows.map((r) => (r.id === id ? toPipelineDeal(data.lead as MarketingLead, names, nowRef.current) : r)),
        );
      }
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      onOk?.(res, data);
    },
    [names, toast],
  );

  const move = useCallback(
    (deal: PipelineDeal, to: LeadStage) => {
      if (to === "lost") {
        setDialog({ kind: "lost", deal });
        return;
      }
      if (to === "won") {
        setDialog({ kind: "won", deal });
        return;
      }
      void mutateOne(
        deal.id,
        (d) => ({ ...d, stage: to, updatedAt: iso(), daysInStage: 0 }),
        () =>
          fetch(`/api/marketing/leads/${deal.id}/stage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage: to }),
          }),
        (res) => {
          if (res.ok) toast.success(`Moved to ${STAGE_LABELS[to]}`);
        },
      );
    },
    [mutateOne, toast],
  );

  const actions: PipelineCardActions = useMemo(
    () => ({
      onMove: move,
      onPriority: (id, p) => {
        void mutateOne(
          id,
          (d) => ({ ...d, priority: p }),
          () =>
            fetch(`/api/marketing/leads/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priority: p ?? "" }),
            }),
        );
      },
      onFollowUp: (deal) => setDialog({ kind: "followup", deal }),
      onAssign: (deal) => setDialog({ kind: "assign", deal }),
      onDelete: (deal) => setDialog({ kind: "delete", deal }),
    }),
    [move, mutateOne],
  );

  const submitFollowUp = (deal: PipelineDeal, value: string | "clear") => {
    setDialog(null);
    void mutateOne(
      deal.id,
      (d) => ({ ...d, nextFollowUpAt: value === "clear" ? undefined : value }),
      () =>
        fetch(`/api/marketing/leads/${deal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nextFollowUpAt: value === "clear" ? "" : value }),
        }),
      (res) => {
        if (res.ok) toast.success(value === "clear" ? "Follow-up cleared" : "Follow-up scheduled");
      },
    );
  };

  const submitAssign = (deal: PipelineDeal, ownerEmail: string) => {
    setDialog(null);
    void mutateOne(
      deal.id,
      (d) => ({ ...d, ownerEmail: ownerEmail || undefined }),
      () =>
        fetch(`/api/marketing/leads/${deal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerEmail }),
        }),
      (res) => {
        if (res.ok) toast.success(ownerEmail ? "Owner assigned" : "Deal unassigned");
      },
    );
  };

  const markLost = (deal: PipelineDeal, reason: LostReason) => {
    setDialog(null);
    void mutateOne(
      deal.id,
      (d) => ({ ...d, stage: "lost", lostReason: reason, updatedAt: iso(), daysInStage: 0, stale: false }),
      () =>
        fetch(`/api/marketing/leads/${deal.id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "lost", lostReason: reason }),
        }),
      (res) => {
        if (res.ok) toast.success("Marked as lost");
      },
    );
  };

  const markWon = (deal: PipelineDeal) => {
    setDialog(null);
    void mutateOne(
      deal.id,
      (d) => ({ ...d, stage: "won", updatedAt: iso(), daysInStage: 0, stale: false }),
      () =>
        fetch(`/api/marketing/leads/${deal.id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "won" }),
        }),
      (res) => {
        if (res.ok) toast.success("Marked as won");
      },
    );
  };

  const removeDeal = (deal: PipelineDeal) => {
    setDialog(null);
    void mutateOne(
      deal.id,
      () => "remove",
      () =>
        fetch(`/api/marketing/leads/${deal.id}`, {
          method: "DELETE",
        }),
      (res) => {
        if (res.ok) toast.success("Deal deleted");
      },
    );
  };

  /* ------------------------------------------------------- render --- */

  const hideOutcomes = outcomesCollapsed || filters.includeOutcomes === false;

  return (
    <div className="space-y-5">
      {canEdit === false && (
        <PermissionNotice message="You can view and filter the pipeline, but changes require the leads.write permission. Select the stage picker and dialogs are disabled for you." />
      )}

      {snapshot.demoCount > 0 && snapshot.demoDefaultExclude && filters.demoExcluded !== false && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p>
            <span className="font-semibold">{snapshot.demoCount} development/test record{snapshot.demoCount === 1 ? " is" : "s are"} hidden</span>{" "}
            from this pipeline.
          </p>
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, demoExcluded: false }))}
            className="rounded-lg border border-amber-300 px-2.5 py-1 font-semibold hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
          >
            Show them
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{boardDeals.length}</span> {boardDeals.length === 1 ? "deal" : "deals"}
          {filtersActive && <span> · filtered</span>}
          {activeValueByCurrency.length > 0 && (
            <span>
              {" · "}
              {activeValueByCurrency.map(([cur, v], i) => (
                <span key={cur} className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {i > 0 && <span aria-hidden="true"> + </span>}
                  {formatMoney(v, cur)}
                </span>
              ))}
              {" annual estimated"}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "import" })}>
                Import
              </Button>
              <Button size="sm" onClick={() => setDialog({ kind: "new" })}>
                ＋ New deal
              </Button>
            </>
          )}
        </div>
      </div>

      <PipelineKpis deals={deals} weights={snapshot.weights} wonThisMonth={snapshot.wonThisMonth} now={now} />

      <PipelineFilterBar
        filters={filters}
        onChange={setFilters}
        ownersUsed={snapshot.ownersUsed}
        sourcesUsed={snapshot.sourcesUsed}
        currenciesUsed={snapshot.currenciesUsed}
        demoCount={snapshot.demoCount}
        demoDefaultExclude={snapshot.demoDefaultExclude}
        view={view}
        onView={setView}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => {
          setSortField(f);
          setSortDir(d);
        }}
        onClearAll={clearAllFilters}
      />

      {boardDeals.length === 0 ? (
        filtersActive ? (
          <FilteredEmptyState onClear={clearAllFilters} />
        ) : (
          <EmptyState
            title="No deals yet"
            body="Add your first deal or run a campaign to bring leads in. They land in the New column."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setDialog({ kind: "new" })}>
                  ＋ New deal
                </Button>
              ) : undefined
            }
          />
        )
      ) : view === "kanban" ? (
        <PipelineKanban
          deals={boardDeals}
          canEdit={canEdit}
          canManage={canManage}
          busyIds={busyIds}
          now={now}
          actions={actions}
          showOutcomes={!hideOutcomes}
          onToggleOutcomes={toggleOutcomes}
        />
      ) : view === "list" ? (
        <PipelineList deals={boardDeals} field={sortField} dir={sortDir} now={now} />
      ) : (
        <PipelineTable
          deals={boardDeals}
          field={sortField}
          dir={sortDir}
          onSort={(f, d) => {
            setSortField(f);
            setSortDir(d);
          }}
          now={now}
        />
      )}

      {dialog?.kind === "new" && (
        <NewDealModal
          open
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            router.refresh();
            toast.success("Deal created");
          }}
        />
      )}
      {dialog?.kind === "import" && (
        <ImportLeadsModal
          open
          onClose={() => setDialog(null)}
          onImported={(r) => {
            setDialog(null);
            router.refresh();
            toast.success(`${r.created} created${r.duplicates ? `, ${r.duplicates} matched existing` : ""}`);
          }}
        />
      )}
      {dialog?.kind === "followup" && (
        <FollowUpDialog
          deal={dialog.deal}
          onClose={() => setDialog(null)}
          onSubmit={(value) => submitFollowUp(dialog.deal, value)}
          busy={busyIds.has(dialog.deal.id)}
        />
      )}
      {dialog?.kind === "assign" && (
        <AssignOwnerDialog
          deal={dialog.deal}
          options={snapshot.users}
          onClose={() => setDialog(null)}
          onSubmit={(email) => submitAssign(dialog.deal, email)}
          busy={busyIds.has(dialog.deal.id)}
        />
      )}
      {dialog?.kind === "lost" && (
        <LostReasonDialog
          leadName={dialog.deal.name}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => markLost(dialog.deal, reason)}
          busy={busyIds.has(dialog.deal.id)}
        />
      )}
      {dialog?.kind === "won" && (
        <ConfirmDialog
          action={{
            title: "Mark as won",
            message: `Mark ${dialog.deal.name} as won?`,
            consequences: [
              "The deal is counted in win-rate and weighted pipeline reporting.",
              "Re-opening later is possible and logged.",
            ],
            confirmLabel: "Mark won",
          }}
          onClose={() => setDialog(null)}
          onConfirm={() => markWon(dialog.deal)}
          busy={busyIds.has(dialog.deal.id)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          action={{
            title: "Delete deal",
            message: `Delete ${dialog.deal.name}?`,
            consequences: [
              "The deal record is permanently removed.",
              "Associated activity and notes are deleted with it.",
              "This action cannot be undone.",
            ],
            confirmLabel: "Delete deal",
            tone: "danger",
          }}
          onClose={() => setDialog(null)}
          onConfirm={() => removeDeal(dialog.deal)}
          busy={busyIds.has(dialog.deal.id)}
        />
      )}
    </div>
  );
}