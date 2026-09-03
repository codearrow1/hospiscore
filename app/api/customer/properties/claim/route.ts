import { NextRequest, NextResponse } from "next/server";
import { originAllowed, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { getPlaceIdentity } from "@/lib/resolver";
import { prisma } from "@/lib/prisma";
import { createClaim } from "@/lib/saas/propertyClaims";
import { writeSaasAudit } from "@/lib/saas/audit";
import { pushNotification } from "@/lib/saas/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/customer/properties/claim
 * { slug: "place:<placeId>", name?, email?, phone? }
 * Authenticated org contact claims a Google listing for their organization.
 * The listing's identity (placeId / name / address / on-file phone) is
 * resolved server-side from Google, never taken verbatim from the client.
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!rateLimit(`claim:${access.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug.startsWith("place:")) {
    return NextResponse.json({ error: "slug must reference a live Google listing (place:<placeId>)" }, { status: 400 });
  }

  const identity = await getPlaceIdentity(slug);
  if (!identity) {
    return NextResponse.json({ error: "Could not resolve the listing from Google; try again or contact support." }, { status: 400 });
  }

  const addrParts = identity.address.split(",").map((s) => s.trim()).filter(Boolean);
  const result = await createClaim({
    organizationId: access.org.organizationId,
    placeId: identity.placeId,
    propertyName: identity.name,
    propertyCity: addrParts.length >= 2 ? addrParts[addrParts.length - 2] : undefined,
    propertyCountry: addrParts.length >= 1 ? addrParts[addrParts.length - 1] : undefined,
    address: identity.address,
    googlePhone: identity.phone,
    requesterName: typeof body.name === "string" ? body.name : undefined,
    requesterEmail: typeof body.email === "string" ? body.email : undefined,
    requesterPhone: typeof body.phone === "string" ? body.phone : undefined,
    acquisitionSource: typeof body.source === "string" ? body.source : undefined,
    acquisitionCampaign: typeof body.campaign === "string" ? body.campaign : undefined,
    createdById: access.user.id,
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "ALREADY_CLAIMED_CONCURRENT") {
      return { ok: false as const, error: "This listing is already claimed by your organization" };
    }
    throw err;
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  const claim = result.claim as { id: string };
  await writeSaasAudit({
    byEmail: access.user.email,
    action: "property_claim.created",
    entity: "propertyClaim",
    entityId: claim.id,
    ip: clientIp(req),
    actorId: access.user.id,
  });
  const claimRec = await prisma.propertyClaim.findUnique({
    where: { id: claim.id },
    select: { propertyName: true },
  });
  await pushNotification({
    userId: access.user.id,
    kind: "property_claim",
    title: "Claim submitted",
    body: `Your claim for ${claimRec?.propertyName ?? "the property"} is submitted and now awaits verification and admin review.`,
    href: "/customer",
  });
  return NextResponse.json({ claim: result.claim }, { status: 201 });
}
