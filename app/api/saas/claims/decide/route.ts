import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { decideClaim } from "@/lib/saas/propertyClaims";
import { writeSaasAudit } from "@/lib/saas/audit";
import { pushNotification, pushNotificationToOrg } from "@/lib/saas/notifications";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/saas/claims/decide { id, decision: approved|rejected, reason? } */
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
  const id = typeof body.id === "string" ? body.id : "";
  const decision = typeof body.decision === "string" ? body.decision : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const result = await decideClaim({
    id,
    decision: decision as "approved" | "rejected",
    reason: typeof body.reason === "string" ? body.reason : undefined,
    decidedBy: guard.user.email,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await writeSaasAudit({
    byEmail: guard.user.email,
    action: `property_claim.${decision === "approved" ? "approved" : "rejected"}`,
    entity: "propertyClaim",
    entityId: id,
    detail: typeof body.reason === "string" ? body.reason : undefined,
    ip: clientIp(req),
  });

  const claimInfo = await prisma.propertyClaim.findUnique({
    where: { id },
    select: {
      propertyName: true,
      organizationId: true,
      createdById: true,
    },
  });
  if (claimInfo) {
    const title = decision === "approved" ? "Claim approved" : "Claim not approved";
    const body =
      decision === "approved"
        ? `Your claim for ${claimInfo.propertyName ?? "the property"} was approved. Continue to onboarding to activate it.`
        : `Your claim for ${claimInfo.propertyName ?? "the property"} was not approved. Contact support if this is in error.`;
    const href = "/customer";
    await pushNotificationToOrg({
      organizationId: claimInfo.organizationId,
      kind: "property_claim",
      title,
      body,
      href,
      excludeUserId: claimInfo.createdById ?? undefined,
    });
    if (claimInfo.createdById) {
      await pushNotification({
        userId: claimInfo.createdById,
        kind: "property_claim",
        title,
        body,
        href,
      });
    }
  }
  return NextResponse.json({ claim: result.claim });
}
