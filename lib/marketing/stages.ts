/**
 * Sales pipeline stages (Phase 12) — labels, styles, legal transitions.
 * The kanban and lead detail UI share these constants so stage currency stays
 * in one place.
 */

import { PIPELINE_STAGES, type LeadStage } from "./types";

export { PIPELINE_STAGES };

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  qualified: "Qualified",
  contacted: "Contacted",
  demo_booked: "Demo booked",
  demo_completed: "Demo completed",
  trial: "Trial",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

/** Ordered forward path (with won/lost as terminal, re-open allowed). */
export const STAGE_ORDER: readonly LeadStage[] = [
  "new",
  "qualified",
  "contacted",
  "demo_booked",
  "demo_completed",
  "trial",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

/** Badge/text styles per stage (dark-theme aware, matches marketing palette). */
export const STAGE_STYLES: Record<LeadStage, string> = {
  new: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  qualified: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  contacted: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  demo_booked: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  demo_completed: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  trial: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  proposal: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  negotiation: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  won: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  lost: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const LOST_REASONS = [
  "budget",
  "chose_competitor",
  "no_response",
  "timing",
  "feature_gap",
  "pricing",
  "other",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  budget: "Budget",
  chose_competitor: "Chose competitor",
  no_response: "No response",
  timing: "Bad timing",
  feature_gap: "Feature gap",
  pricing: "Pricing",
  other: "Other",
};

export function isLostReason(v: unknown): v is LostReason {
  return typeof v === "string" && (LOST_REASONS as readonly string[]).includes(v);
}

export const WON_STAGE: LeadStage = "won";
export const LOST_STAGE: LeadStage = "lost";

/** Prevents absurd backward moves; won/lost are terminal except re-open. */
export function canMove(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return false;
  if (from === "won" || from === "lost") return to === "new" || to === "qualified";
  if (to === "won") {
    return from === "demo_completed" || from === "trial" || from === "proposal" || from === "negotiation";
  }
  if (to === "lost") return from !== "new";
  return STAGE_ORDER.indexOf(to) >= STAGE_ORDER.indexOf(from) - 1;
}

export function stageIndex(stage: LeadStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isLeadStage(v: unknown): v is LeadStage {
  return typeof v === "string" && (PIPELINE_STAGES as readonly string[]).includes(v);
}

export { PIPELINE_STAGES as LEAD_STAGES };