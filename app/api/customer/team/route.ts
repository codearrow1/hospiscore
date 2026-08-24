import { NextRequest, NextResponse } from "next/server";
import { originAllowed, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Team management for the customer portal (Phase 7).
 *
 * Invites create OrgContact rows scoped to the caller's organization.
 * BACKEND GAP (labeled): outbound invitation emails are not wired to the
 * mailer yet — the portal surfaces this honestly. Identity binding happens
 * automatically when the invitee registers with the same email or redeems a
 * claim token minted by an admin.
 */

const ROLES = ["owner", "billing", "tech"];

/** GET /api/customer/team — org contacts. */
export async function GET(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const contacts = await prisma.orgContact.findMany({
    where: { organizationId: access.org.organizationId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, isPrimary: true },
  });
  return NextResponse.json({ contacts });
}

/** POST /api/customer/team { name, email, role? } — invite a colleague. */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!rateLimit(`custteam:${access.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" && ROLES.includes(body.role) ? body.role : "tech";
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Name and a valid email are required" }, { status: 400 });
  }

  // Plan seat cap mirrors the property cap check.
  const activeSub = await prisma.subscription.findFirst({
    where: { organizationId: access.org.organizationId, status: { in: ["active", "trial"] } },
    include: { plan: { select: { maxUsers: true, name: true } } },
  });
  const existing = await prisma.orgContact.count({ where: { organizationId: access.org.organizationId } });
  const cap = activeSub?.plan.maxUsers ?? null;
  if (cap !== null && existing >= cap) {
    return NextResponse.json(
      { error: `Your ${activeSub?.plan.name ?? "current"} plan allows ${cap} team member${cap === 1 ? "" : "s"} — upgrade to add more` },
      { status: 400 },
    );
  }
  const dupe = await prisma.orgContact.findFirst({
    where: { organizationId: access.org.organizationId, email },
  });
  if (dupe) return NextResponse.json({ error: "This email is already on the team" }, { status: 400 });

  const contact = await prisma.orgContact.create({
    data: { organizationId: access.org.organizationId, name: name.slice(0, 120), email, role },
    select: { id: true, name: true, email: true, role: true, isPrimary: true },
  });
  return NextResponse.json({
    contact,
    notice: "Invite saved. Email delivery is not wired yet — share the portal link with them directly.",
  }, { status: 201 });
}

/** DELETE /api/customer/team?id=… — remove a non-primary contact. */
export async function DELETE(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const contact = id
    ? await prisma.orgContact.findFirst({ where: { id, organizationId: access.org.organizationId } })
    : null;
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (contact.isPrimary) {
    return NextResponse.json({ error: "The primary contact cannot be removed — set another primary first" }, { status: 400 });
  }
  await prisma.orgContact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
