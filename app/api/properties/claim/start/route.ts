import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/marketing/guard";
import { getPlaceIdentity } from "@/lib/resolver";
import { createClaimRequest } from "@/lib/saas/propertyClaims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/properties/claim/start
 * { slug: "place:<placeId>", name?, email, phone?, source?, campaign? }
 *
 * Pre-identity step of the claim flow. Resolves the listing's identity
 * server-side from Google (placeId / name / address / on-file phone), then
 * mints a one-time, expiring property-claim request token. That token is later
 * redeemed on register/login (?claim=token) to create the canonical
 * PropertyClaim. This is a high-volume, low-trust path — the token alone is
 * what authorizes claim creation, so it is rate-limited by IP and never trusts
 * the browser's placeId verbatim.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`claimstart:${clientIp(req)}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, slow down" }, { status: 429 });
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
  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

  const identity = await getPlaceIdentity(slug);
  if (!identity) {
    return NextResponse.json({ error: "Could not resolve the listing from Google; try again or contact support." }, { status: 400 });
  }

  const addrParts = identity.address.split(",").map((s) => s.trim()).filter(Boolean);
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  const { token, expiresAt } = await createClaimRequest({
    placeId: identity.placeId,
    propertyName: identity.name,
    propertyCity: addrParts.length >= 2 ? addrParts[addrParts.length - 2] : null,
    propertyCountry: addrParts.length >= 1 ? addrParts[addrParts.length - 1] : null,
    address: identity.address,
    googlePhone: identity.phone,
    requesterName: name || undefined,
    requesterEmail: email,
    requesterPhone: phone || undefined,
    acquisitionSource: typeof body.source === "string" ? body.source : null,
    acquisitionCampaign: typeof body.campaign === "string" ? body.campaign : null,
  });

  return NextResponse.json(
    {
      claimToken: token,
      expiresAt,
      property: {
        placeId: identity.placeId,
        name: identity.name,
        address: identity.address,
        maskedPhone: identity.phone ? maskPhone(identity.phone) : null,
      },
    },
    { status: 201 },
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : phone;
}
