import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updateTicket } from "@/lib/saas/support";
import type { TicketStatus } from "@/lib/saas/support";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { pushNotification } from "@/lib/saas/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUPPORT_MANAGE")) return NextResponse.json({ error: "SUPPORT_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const ticket = await updateTicket(id, {
      status: typeof body.status === "string" ? (body.status as TicketStatus) : undefined,
      assigneeEmail: typeof body.assigneeEmail === "string" ? body.assigneeEmail : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      noteFirstResponse: body.firstResponse === true,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: `ticket.${body.status ? String(body.status) : "updated"}`, entity: "ticket", entityId: id, ip: clientIp(req) });
    if (typeof body.status === "string") {
      await pushNotification({
        userId: guard.user.email,
        kind: `ticket.${body.status}`,
        title: `Ticket ${body.status.replace("_", " ")}`,
        body: `Ticket ${id.slice(-8)} moved to ${body.status.replace("_", " ")}`,
        href: "/saas",
      });
    }
    return NextResponse.json({ ticket });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
