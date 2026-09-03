import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, originAllowed, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { createPortalClaimToken, isPortalKind, type PortalKind } from "@/lib/saas/portalLinks";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_PERM: Record<PortalKind, Parameters<typeof hasSaasPerm>[1]> = {
  affiliate: "AFFILIATE_MANAGE",
  partner: "PARTNER_MANAGE",
  org_contact: "CUSTOMER_MANAGE",
};

/**
 * POST /api/saas/portals/claims { kind: affiliate|partner|org_contact, refId }
 * Mints a one-time, 15-minute claim token binding a fresh registration to an
 * existing portal identity. The plaintext token is shown exactly once — hand
 * it to the real owner out-of-band.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const kind = body.kind;
  if (!isPortalKind(kind)) return NextResponse.json({ error: "kind must be affiliate|partner|org_contact" }, { status: 400 });
  if (typeof body.refId !== "string" || !body.refId.trim()) {
    return NextResponse.json({ error: "refId required" }, { status: 400 });
  }
  if (!hasSaasPerm(guard.user, KIND_PERM[kind])) {
    return NextResponse.json({ error: `${KIND_PERM[kind]} required` }, { status: 403 });
  }

  try {
    const { token, expiresAt } = await createPortalClaimToken({ kind, refId: body.refId, createdBy: guard.user.email });
    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "portal.claim_token_created",
      entity: kind,
      entityId: body.refId,
      detail: `expires ${expiresAt}`,
      ip: clientIp(req),
    });
    return NextResponse.json({ token, expiresAt, kind }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Mint failed" }, { status: 400 });
  }
}
