import { NextRequest, NextResponse } from "next/server";
import { originAllowed, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Team management for the customer portal (Phase 7).
 *
 * Invites create OrgContact rows scoped to the caller's organization.
 * Identity binding happens automatically when the invitee registers with the
 * same email or redeems a claim token minted by an admin.
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

  const portalUrl = `${req.nextUrl.origin}/account`;
  try {
    const orgName = await prisma.organization.findUnique({ where: { id: access.org.organizationId }, select: { legalName: true } });
    await sendMail({
      to: email,
      subject: `You've been added to a team on HospiOS`,
      html: `<p>You've been added as <strong>${role}</strong> on the HospiOS customer portal${orgName?.legalName ? ` (${orgName.legalName})` : ""}.</p>
<p><a href="${portalUrl}">Open the portal</a> and sign in or create an account with this email address. Your team access will bind automatically.</p>`,
    });
  } catch {
    // Mail failure is non-fatal.
  }

  return NextResponse.json({
    contact,
  }, { status: 201 });
}

/**
 * PATCH /api/customer/team
 * Two owner-only actions (the caller must be this org's primary contact):
 *   { id, role }                — change a team member's role (owner|billing|tech)
 *   { id, transferPrimary:true }— make `id` the new primary contact (owner)
 */
export async function PATCH(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const orgId = access.org.organizationId;

  if (!access.org.isPrimary) {
    return NextResponse.json({ error: "Only the primary contact can manage team roles" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const target = id
    ? await prisma.orgContact.findFirst({ where: { id, organizationId: orgId } })
    : null;
  if (!target) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Change role
  if (body.role !== undefined) {
    const role = typeof body.role === "string" && ROLES.includes(body.role) ? body.role : null;
    if (!role) return NextResponse.json({ error: "role must be owner, billing or tech" }, { status: 400 });
    const updated = await prisma.orgContact.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isPrimary: true },
    });
    return NextResponse.json({ contact: updated });
  }

  // Transfer primary ownership
  if (body.transferPrimary === true) {
    if (target.id === access.org.contactId) {
      return NextResponse.json({ error: "This contact is already the primary" }, { status: 400 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.orgContact.updateMany({ where: { organizationId: orgId, isPrimary: true }, data: { isPrimary: false } });
      return tx.orgContact.update({
        where: { id: target.id },
        data: { isPrimary: true, role: target.role || "owner" },
        select: { id: true, name: true, email: true, role: true, isPrimary: true },
      });
    });
    return NextResponse.json({ contact: updated });
  }

  return NextResponse.json({ error: "Unsupported action — provide role or transferPrimary:true" }, { status: 400 });
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
