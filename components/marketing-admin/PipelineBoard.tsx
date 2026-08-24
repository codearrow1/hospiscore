"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { STAGE_LABELS, STAGE_STYLES, STAGE_ORDER } from "@/lib/marketing/stages";
import { canMove } from "@/lib/marketing/stages";
import { formatMoney } from "@/lib/format";
import type { LostReason } from "@/lib/marketing/stages";
import type { LeadStage } from "@/lib/marketing/types";
import { useToast } from "@/components/ui/Toast";
import { LostReasonDialog } from "./LostReasonDialog";

export interface PipelineLead {
  id: string;
  name: string;
  email: string;
  ownerEmail?: string;
  estimatedValue: number;
  estimatedValueCurrency?: string;
  stage: LeadStage;
  nextFollowUpAt?: string;
}

/** One-line guidance per empty column so the board reads as a process,
 *  not a row of blank boxes. */
const EMPTY_HINTS: Record<LeadStage, string> = {
  new: "Form and demo submissions land here.",
  qualified: "Score ≥ 40 or manually qualify.",
  contacted: "Log the first email or call.",
  demo_booked: "Book a demo from a lead.",
  demo_completed: "Mark demos completed after the call.",
  trial: "Trials started by sales appear here.",
  proposal: "Send pricing to move deals in.",
  negotiation: "Late-stage deals being worked.",
  won: "Closed deals — 🎉",
  lost: "Lost deals with a recorded reason.",
};

export default function PipelineBoard({ leads, filterBar }: { leads: PipelineLead[]; filterBar?: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [losing, setLosing] = useState<{ lead: PipelineLead; to: LeadStage } | null>(null);

  const groups = STAGE_ORDER.reduce<Record<string, PipelineLead[]>>((acc, s) => {
    acc[s] = [];
    return acc;
  }, {} as Record<string, PipelineLead[]>);
  for (const lead of leads) {
    (groups[lead.stage] ??= []).push(lead);
  }

  const move = async (id: string, from: LeadStage, to: LeadStage, lostReason?: LostReason) => {
    if (!to || to === from) return;
    setBusyId(id);
    const body: Record<string, unknown> = { stage: to };
    if (to === "lost" && lostReason) body.lostReason = lostReason;
    const res = await fetch(`/api/marketing/leads/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (res.ok) {
      setLosing(null);
      router.refresh();
    } else toast.error((await res.json().catch(() => ({}))).error ?? "Could not move lead");
  };

  /** Intercept moves: marking lost requires a structured reason. */
  const requestMove = (lead: PipelineLead, to: LeadStage) => {
    if (to === "lost") setLosing({ lead, to });
    else void move(lead.id, lead.stage, to);
  };

  return (
    <div className="space-y-4">
      {filterBar && <div className="flex flex-wrap items-center gap-3">{filterBar}</div>}
      {/* Mobile: horizontally snapping rail. lg+: full-width grid. */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 lg:grid lg:snap-none lg:grid-cols-5 lg:overflow-visible 2xl:grid-cols-10">
        {STAGE_ORDER.map((stage) => {
          const items = groups[stage] ?? [];
          return (
            <div key={stage} className="w-[264px] shrink-0 snap-start rounded-2xl border border-zinc-200 bg-zinc-50/70 p-2.5 lg:w-auto dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STAGE_STYLES[stage]}`}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed border-zinc-300 px-2.5 py-5 text-center text-[11px] leading-snug text-zinc-400 dark:border-zinc-700">
                    {EMPTY_HINTS[stage]}
                  </p>
                )}
                {items.map((lead) => {
                  const options = STAGE_ORDER.filter((s) => canMove(lead.stage, s));
                  return (
                    <div
                      key={lead.id}
                      className="group rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                    >
                      <Link href={`/marketing-admin/leads/${lead.id}`} className="block">
                        <p className="truncate text-sm font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-50 dark:group-hover:text-indigo-400">
                          {lead.name}
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">{lead.email}</p>
                      </Link>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {lead.estimatedValue > 0 ? formatMoney(lead.estimatedValue, lead.estimatedValueCurrency ?? "USD") : "—"}
                        </span>
                        {lead.nextFollowUpAt && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            ↻ {new Date(lead.nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="truncate text-[10px] text-zinc-400">{lead.ownerEmail ?? "unassigned"}</span>
                        <select
                          value={lead.stage}
                          disabled={busyId === lead.id}
                          aria-label={`Move ${lead.name}`}
                          onChange={(e) => requestMove(lead, e.target.value as LeadStage)}
                          className="rounded-md border border-zinc-200 bg-white px-1 py-0.5 text-[10px] text-zinc-600 outline-none focus:border-indigo-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          <option value={lead.stage}>{STAGE_LABELS[lead.stage]}</option>
                          {options.map((s) => (
                            <option key={s} value={s}>
                              {STAGE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {losing && (
        <LostReasonDialog
          leadName={losing.lead.name}
          onClose={() => setLosing(null)}
          onConfirm={(reason) => {
            const target = losing;
            setLosing(null);
            void move(target.lead.id, target.lead.stage, target.to, reason);
          }}
          busy={busyId !== null}
        />
      )}
    </div>
  );
}