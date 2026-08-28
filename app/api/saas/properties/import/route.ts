import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { importProperty, type NewOrgInput, type ImportAttribution } from "@/lib/saas/propertyImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function obj<T>(v: unknown): T | undefined {
  return v && typeof v === "object" ? (v as T) : undefined;
}

/**
 * POST /api/saas/properties/import
 * { placeId, organizationId?, newOrg?, attribution?, force? }
 * Admin-gated Google → Property import. Idempotent & dedupe-safe.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PROPERTY_MANAGE")) {
    return NextResponse.json({ error: "PROPERTY_MANAGE required" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const placeId = str(body.placeId);
  if (!placeId) return NextResponse.json({ error: "placeId is required" }, { status: 400 });

  const newOrgInput = obj<{ legalName?: unknown; businessName?: unknown; country?: unknown; website?: unknown }>(body.newOrg);
  const newOrg: NewOrgInput | undefined = newOrgInput?.legalName
    ? {
        legalName: String(newOrgInput.legalName),
        businessName: str(newOrgInput.businessName),
        country: str(newOrgInput.country),
        website: str(newOrgInput.website),
      }
    : undefined;

  const attributionBody = obj<{ acquisitionSource?: unknown; acquisitionCampaign?: unknown; affiliateId?: unknown; partnerId?: unknown }>(body.attribution);
  const attribution: ImportAttribution | undefined = {
    acquisitionSource: str(attributionBody?.acquisitionSource),
    acquisitionCampaign: str(attributionBody?.acquisitionCampaign),
    affiliateId: str(attributionBody?.affiliateId),
    partnerId: str(attributionBody?.partnerId),
  };

  const result = await importProperty({
    placeId,
    organizationId: str(body.organizationId),
    newOrg,
    attribution,
    force: body.force === true,
    byEmail: guard.user.email,
    ip: clientIp(req),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
}
