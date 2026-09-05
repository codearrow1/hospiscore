"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGE_LABELS, STAGE_STYLES, STAGE_ORDER } from "@/lib/marketing/stages";
import { canMove } from "@/lib/marketing/stages";
import type { LeadStage } from "@/lib/marketing/types";

export interface PipelineLead {
  id: string;
  name: string;
  email: string;
  ownerEmail?: string;
  estimatedValue: number;
  stage: LeadStage;
  nextFollowUpAt?: string;
}

export default function PipelineBoard({ leads }: { leads: PipelineLead[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const groups = STAGE_ORDER.reduce<Record<string, PipelineLead[]>>((acc, s) => {
    acc[s] = [];
    return acc;
  }, {} as Record<string, PipelineLead[]>);
  for (const lead of leads) {
    (groups[lead.stage] ??= []).push(lead);
  }

  const move = async (id: string, from: LeadStage, to: LeadStage) => {
    if (!to || to === from) return;
    setBusy(true);
    const body: Record<string, unknown> = { stage: to };
    if (to === "lost") {
      const reason = window.prompt("Lost reason? budget / chose_competitor / no_response / timing / feature_gap / pricing / other");
      if (!reason) {
        setBusy(false);
        return;
      }
      body.lostReason = reason;
    }
    const res = await fetch(`/api/marketing/leads/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert((await res.json()).error ?? "Could not move lead");
  };

  return (
    <div className="grid gap-3 overflow-x-auto pb-4 lg:grid-cols-5 2xl:grid-cols-10">
      {STAGE_ORDER.map((stage) => {
        const items = groups[stage] ?? [];
        return (
          <div key={stage} className="min-w-[220px] rounded-2xl border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
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
                <p className="rounded-xl border border-dashed border-zinc-200 px-2 py-5 text-center text-[11px] text-zinc-300 dark:border-zinc-800" />
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
                        {lead.estimatedValue > 0 ? `$${lead.estimatedValue.toLocaleString()}` : "—"}
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
                        disabled={busy}
                        aria-label={`Move ${lead.name}`}
                        onChange={(e) => move(lead.id, lead.stage, e.target.value as LeadStage)}
                        className="rounded-md border border-zinc-200 bg-white px-1 py-0.5 text-[10px] text-zinc-600 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
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
  );
}