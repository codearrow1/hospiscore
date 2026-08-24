/**
 * SaaS Support — Phase N (P2 #25)
 * Tickets feed customer health (open-ticket signal) and track SLA.
 * Pure lifecycle/SLA rules live in ticketRules.ts (client-safe); this module
 * adds the Prisma-backed operations.
 */
import { prisma } from "@/lib/prisma";
import {
  TICKET_CATEGORIES,
  PRIORITIES,
  slaDueFor,
  canTransitionTicket,
  type TicketStatus,
} from "@/lib/saas/ticketRules";

export {
  TICKET_CATEGORIES,
  type TicketCategory,
  type TicketStatus,
  TICKET_STATUSES,
  canTransitionTicket,
  PRIORITIES,
  type TicketPriority,
  slaDueFor,
  isSlaBreached,
} from "@/lib/saas/ticketRules";

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
