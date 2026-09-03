import { NextRequest, NextResponse } from "next/server";
import { originAllowed, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/customer/properties — the caller's organization properties. */
export async function GET(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const properties = await prisma.property.findMany({
    where: { organizationId: access.org.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, city: true, country: true, rooms: true, status: true },
  });
  return NextResponse.json({ properties });
}

/** POST /api/customer/properties { name, city?, country?, rooms? } — self-service add. */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!rateLimit(`custprop:${access.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Property name must be between 2 and 120 characters" }, { status: 400 });
  }
  // Plan property cap is enforced here so the portal cannot oversell a plan.
  const org = await prisma.organization.findUnique({
    where: { id: access.org.organizationId },
    select: { _count: { select: { properties: true } } },
  });
  const activeSub = await prisma.subscription.findFirst({
    where: { organizationId: access.org.organizationId, status: { in: ["active", "trial"] } },
    include: { plan: { select: { maxProperties: true, name: true } } },
  });
  const cap = activeSub?.plan.maxProperties ?? null;
  if (cap !== null && (org?._count.properties ?? 0) >= cap) {
    return NextResponse.json(
      { error: `Your ${activeSub?.plan.name ?? "current"} plan allows ${cap} propert${cap === 1 ? "y" : "ies"} — upgrade to add more` },
      { status: 400 },
    );
  }
  const roomsRaw = Number(body.rooms);
  const property = await prisma.property.create({
    data: {
      organizationId: access.org.organizationId,
      name,
      city: typeof body.city === "string" ? body.city.trim() || null : null,
      country: typeof body.country === "string" ? body.country.trim().toUpperCase().slice(0, 2) || null : null,
      rooms: Number.isFinite(roomsRaw) && roomsRaw > 0 ? Math.round(roomsRaw) : null,
    },
    select: { id: true, name: true, city: true, country: true, rooms: true, status: true },
  });
  return NextResponse.json({ property }, { status: 201 });
}

/** PATCH /api/customer/properties { id, name?, rooms? } — limited self-service edits. */
export async function PATCH(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const owned = id ? await prisma.property.findFirst({ where: { id, organizationId: access.org.organizationId } }) : null;
  if (!owned) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const data: { name?: string; rooms?: number | null } = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim().slice(0, 120);
  if (body.rooms === null || body.rooms === "") data.rooms = null;
  else {
    const roomsRaw = Number(body.rooms);
    if (Number.isFinite(roomsRaw) && roomsRaw > 0) data.rooms = Math.round(roomsRaw);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const property = await prisma.property.update({ where: { id }, data });
  return NextResponse.json({ property: { id: property.id, name: property.name, rooms: property.rooms } });
}
