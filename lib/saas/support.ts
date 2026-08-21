/**
 * SaaS Support — Phase N (P2 #25)
 * Tickets feed customer health (open-ticket signal) and track SLA.
 * SLA targets by priority: urgent 4h, high 8h, medium 24h, low 72h.
 */
import { prisma } from "@/lib/prisma";

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

export function slaDueFor(priority: string, from = new Date()): Date {
  const hours = priority === "urgent" ? 4 : priority === "high" ? 8 : priority === "medium" ? 24 : 72;
  return new Date(from.getTime() + hours * 3600000);
}

export function isSlaBreached(t: { status: string; slaDueAt: Date | null; resolvedAt: Date | null; firstResponseAt: Date | null }): boolean {
  if (!t.slaDueAt || t.resolvedAt || t.status === "closed") return false;
  return t.slaDueAt.getTime() < Date.now();
}

export async function createTicket(input: {
  organizationId: string;
  category: string;
  subject: string;
  description?: string;
  priority?: string;
  requesterEmail?: string;
}) {
  if (!TICKET_CATEGORIES.includes(input.category as never)) throw new Error("Invalid category");
  const subject = input.subject?.trim();
  if (!subject || subject.length < 3) throw new Error("Subject required (min 3 chars)");
  const priority = input.priority && PRIORITIES.includes(input.priority as never) ? input.priority : "medium";
  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
  if (!org) throw new Error("Organization not found");
  return prisma.supportTicket.create({
    data: {
      organizationId: input.organizationId,
      category: input.category,
      subject,
      description: input.description?.slice(0, 4000) || null,
      priority,
      requesterEmail: input.requesterEmail || null,
      slaDueAt: slaDueFor(priority),
    },
  });
}

export async function listTickets(opts?: { organizationId?: string; status?: string; category?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.organizationId) where.organizationId = opts.organizationId;
  if (opts?.status) where.status = opts.status;
  if (opts?.category) where.category = opts.category;
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: { organization: { select: { legalName: true, country: true } } },
      orderBy: [{ status: "asc" }, { slaDueAt: "asc" }],
      take: 200,
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return { items, total };
}

export async function updateTicket(id: string, patch: { status?: TicketStatus; assigneeEmail?: string; priority?: string; noteFirstResponse?: boolean }) {
  const cur = await prisma.supportTicket.findUnique({ where: { id } });
  if (!cur) throw new Error("Ticket not found");
  const data: Record<string, unknown> = {};
  if (patch.status) {
    if (!canTransitionTicket(cur.status as TicketStatus, patch.status)) throw new Error(`Cannot transition ${cur.status} → ${patch.status}`);
    data.status = patch.status;
    if (patch.status === "resolved") data.resolvedAt = new Date();
    if (cur.status === "resolved" && patch.status === "in_progress") data.resolvedAt = null;
  }
  if (patch.assigneeEmail !== undefined) data.assigneeEmail = patch.assigneeEmail || null;
  if (patch.priority && PRIORITIES.includes(patch.priority as never)) data.priority = patch.priority;
  if (patch.noteFirstResponse && !cur.firstResponseAt) data.firstResponseAt = new Date();
  return prisma.supportTicket.update({ where: { id }, data });
}

/** Open tickets older than 90d are excluded; feeds health engine. */
export async function countRecentOpenTickets(organizationId: string): Promise<number> {
  const since = new Date(Date.now() - 90 * 86400000);
  return prisma.supportTicket.count({
    where: { organizationId, createdAt: { gte: since }, status: { in: ["open", "pending", "in_progress"] } },
  });
}
