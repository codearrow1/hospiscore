import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { createTicket, listTickets } from "@/lib/saas/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CUSTOMER_CATEGORIES = ["billing", "technical", "subscription", "account", "integration", "onboarding"];

/**
 * POST /api/customer/support { category, subject, description }
 * Support entry point for the customer portal. Scoped to the caller's own
 * organization; priority is always queued as medium (staff can raise it).
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!rateLimit(`custticket:${access.user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests — try again shortly" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" && CUSTOMER_CATEGORIES.includes(body.category) ? body.category : "account";
  if (subject.length < 4 || subject.length > 160) {
    return NextResponse.json({ error: "Subject must be between 4 and 160 characters" }, { status: 400 });
  }

  try {
    const ticket = await createTicket({
      organizationId: access.org.organizationId,
      category,
      subject,
      description: description || undefined,
      requesterEmail: access.user.email,
    });
    return NextResponse.json({ ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}

/** GET /api/customer/support — the caller's organization tickets. */
export async function GET(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  void clientIp(req);
  const { items } = await listTickets({ organizationId: access.org.organizationId });
  return NextResponse.json({
    tickets: items.slice(0, 20).map((t) => ({
      id: t.id, subject: t.subject, status: t.status, category: t.category,
      priority: t.priority, createdAt: t.createdAt.toISOString(), slaDueAt: t.slaDueAt?.toISOString() ?? null,
    })),
  });
}
