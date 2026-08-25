import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/support/[id]/comments — list comments for a ticket.
 * POST /api/saas/support/[id]/comments — add a comment (admin or customer).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUPPORT_VIEW")) return NextResponse.json({ error: "SUPPORT_VIEW required" }, { status: 403 });
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUPPORT_MANAGE")) return NextResponse.json({ error: "SUPPORT_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  if (bodyText.length < 1) return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  const isInternal = body.isInternal === true;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, organizationId: true, requesterEmail: true, subject: true, organization: { select: { legalName: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: id,
      authorEmail: guard.user.email,
      authorName: guard.user.name ?? guard.user.email,
      body: bodyText.slice(0, 4000),
      isInternal,
    },
  });

  await writeSaasAudit({
    byEmail: guard.user.email,
    action: "ticket.comment_added",
    entity: "ticket",
    entityId: id,
    detail: `${isInternal ? "(internal) " : ""}${bodyText.slice(0, 120)}`,
    ip: clientIp(req),
  });

  // Notify the requester (if not the same person and comment is not internal)
  if (!isInternal && ticket.requesterEmail && ticket.requesterEmail !== guard.user.email) {
    try {
      const origin = req.nextUrl.origin;
      await sendMail({
        to: ticket.requesterEmail,
        subject: `New reply on ticket: ${ticket.subject}`,
        html: `<p>A team member replied to your support ticket "<strong>${ticket.subject}</strong>" (${ticket.organization?.legalName ?? ""}):</p>
<blockquote>${bodyText.replace(/\n/g, "<br/>")}</blockquote>
<p><a href="${origin}/customer">Open your portal</a> to view the full conversation.</p>`,
      });
    } catch {
      // Mail failure is non-fatal.
    }
  }

  return NextResponse.json({ comment }, { status: 201 });
}
