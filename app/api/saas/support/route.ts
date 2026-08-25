import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listTickets, createTicket } from "@/lib/saas/support";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { pushNotification } from "@/lib/saas/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUPPORT_VIEW")) return NextResponse.json({ error: "SUPPORT_VIEW required" }, { status: 403 });
  const organizationId = req.nextUrl.searchParams.get("organizationId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const { items, total } = await listTickets({ organizationId, status, category });
  return NextResponse.json({ tickets: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUPPORT_MANAGE")) return NextResponse.json({ error: "SUPPORT_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const ticket = await createTicket({
      organizationId: String(body.organizationId ?? ""),
      category: String(body.category ?? ""),
      subject: String(body.subject ?? ""),
      description: typeof body.description === "string" ? body.description : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      requesterEmail: typeof body.requesterEmail === "string" ? body.requesterEmail : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "ticket.created", entity: "ticket", entityId: ticket.id, detail: `${ticket.category}/${ticket.priority} ${ticket.subject}`.slice(0, 200), ip: clientIp(req) });
    // Notify the ticket creator and all admins
    await pushNotification({
      userId: guard.user.email,
      kind: "ticket.created",
      title: `Ticket created: ${ticket.subject}`,
      body: `${ticket.category}/${ticket.priority} — ${ticket.subject}`,
      href: "/saas",
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}

