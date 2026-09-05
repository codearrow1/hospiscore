/**
 * Configurable lead scoring (Phase 13).
 *
 * Signals are weighted rules evaluated against a lead; the ruleset is data
 * (not hardcoded) so the team can tune it from settings without redeploying.
 * Scores map to bands: cold < 20, warm < 40, hot < 70, else very_hot.
 */

import type { MarketingLead } from "./types";

export type ScoreRule = {
  id: string;
  label: string;
  points: number;
  match: (lead: Partial<MarketingLead>) => boolean;
};

export const BASE_RULES: ScoreRule[] = [
  { id: "rooms_20", label: "Property > 20 rooms", points: 10, match: (l) => (l.rooms ?? 0) > 20 },
  { id: "rooms_50", label: "Property > 50 rooms", points: 10, match: (l) => (l.rooms ?? 0) > 50 },
  { id: "demo_requested", label: "Demo requested", points: 10, match: (l) => l.demoId != null },
  { id: "trial_started", label: "Trial started", points: 15, match: (l) => l.trialStartedAt != null },
  { id: "pricing_page", label: "Pricing page viewed", points: 10, match: (l) => l.attribution?.pagePath?.includes("/pricing") ?? false },
  { id: "plan_interest", label: "High-tier plan interest", points: 10, match: (l) => l.planInterest === "growth" || l.planInterest === "professional" || l.planInterest === "enterprise" },
  { id: "corporate_email", label: "Company email domain", points: 10, match: (l) => {
      const local = l.email?.split("@")[1] ?? "";
      return local.length > 0 && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com"].includes(local);
    } },
  { id: "company_present", label: "Company provided", points: 5, match: (l) => Boolean(l.company || l.propertyName) },
  { id: "campaign_utm", label: "Campaign / paid source", points: 5, match: (l) => Boolean(l.attribution?.campaign) || ["google_ads", "meta_ads", "linkedin", "youtube"].includes(l.source as string) },
  { id: "message_present", label: "Detailed enquiry", points: 5, match: (l) => (l.message?.length ?? 0) >= 40 },
  // Negative signals
  { id: "no_phone", label: "No phone provided", points: -10, match: (l) => !l.phone },
  { id: "invalid_contact", label: "Invalid contact flag", points: -10, match: (l) => l.source === "other" && !l.email },
];

export interface ScoreBand {
  min: number;
  label: string;
  tone: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  { min: 70, label: "Very hot", tone: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  { min: 40, label: "Hot", tone: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { min: 20, label: "Warm", tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { min: -Infinity, label: "Cold", tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
];

export function scoreLead(
  lead: Partial<MarketingLead>,
  rules: readonly ScoreRule[] = BASE_RULES,
): { score: number; band: MarketingLead["band"]; applied: string[] } {
  let score = 0;
  const applied: string[] = [];
  if (!Array.isArray(rules)) rules = BASE_RULES;
  for (const rule of rules) {
    if (rule.match(lead)) {
      score += rule.points;
      applied.push(rule.id);
    }
  }
  const band = bandFor(score);
  return { score, band, applied };
}

export function bandFor(score: number): MarketingLead["band"] {
  for (const b of SCORE_BANDS) {
    if (score >= b.min) return b.label.toLowerCase().replace(" ", "_") as MarketingLead["band"];
  }
  return "cold";
}

export function applyScoring(
  lead: Partial<MarketingLead>,
  rules: readonly ScoreRule[] = BASE_RULES,
): Pick<MarketingLead, "score" | "band"> {
  const { score, band } = scoreLead(lead, rules);
  return { score, band };
}