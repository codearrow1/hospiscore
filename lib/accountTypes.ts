/** Shared, serializable types for the account feature (client-safe). */

export interface PublicAuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** Internal-leads access (see ADMIN_EMAILS). Never true for public visitors. */
  isAdmin?: boolean;
}

export type SavedItem = {
  slug: string;
  name: string;
  city: string;
  country: string;
  color: string;
  savedAt: string;
  score: number;
  grade: "Poor" | "Fair" | "Good" | "Excellent";
  history: { at: string; overall: number }[];
};

export const GRADE_COLOR: Record<SavedItem["grade"], string> = {
  Poor: "text-red-600",
  Fair: "text-amber-600",
  Good: "text-emerald-600",
  Excellent: "text-sky-600",
};

/** Sales-funnel status for captured leads (new / contacted / won / closed). */
export type LeadStatus = "new" | "contacted" | "won" | "closed";

export const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "won", "closed"];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  won: "Won",
  closed: "Closed",
};

/** Badge classes per status (dark-theme aware). */
export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  contacted: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  won: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}