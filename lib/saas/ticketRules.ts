/**
 * Pure support-ticket rules — client-safe (no Prisma import).
 * Both the API layer (lib/saas/support.ts) and UI components import from here
 * so lifecycle semantics stay in one place.
 */

export const TICKET_CATEGORIES = ["billing","technical","subscription","account","integration","bug","onboarding","affiliate","partner","franchise"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type TicketStatus = "open" | "pending" | "in_progress" | "resolved" | "closed";
export const TICKET_STATUSES: TicketStatus[] = ["open", "pending", "in_progress", "resolved", "closed"];

const ALLOWED_STATUS: Record<TicketStatus, TicketStatus[]> = {
  open: ["pending", "in_progress", "resolved", "closed"],
  pending: ["in_progress", "resolved", "closed"],
  in_progress: ["pending", "resolved", "closed"],
  resolved: ["closed", "in_progress"], // reopen path
  closed: [],
};

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return false;
  return ALLOWED_STATUS[from]?.includes(to) ?? false;
}

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof PRIORITIES)[number];

export const DEFAULT_SLA_HOURS: Record<string, number> = { urgent: 4, high: 8, medium: 24, low: 72 };

/** SLA targets by priority: urgent 4h, high 8h, medium 24h, low 72h. Pass `hours` to use resolver-driven values. */
export function slaDueFor(priority: string, from = new Date(), hours?: Record<string, number>): Date {
  const h = hours?.[priority] ?? DEFAULT_SLA_HOURS[priority] ?? 72;
  return new Date(from.getTime() + h * 3600000);
}

export function isSlaBreached(t: { status: string; slaDueAt: Date | null; resolvedAt: Date | null; firstResponseAt: Date | null }): boolean {
  if (!t.slaDueAt || t.resolvedAt || t.status === "closed") return false;
  return t.slaDueAt.getTime() < Date.now();
}
