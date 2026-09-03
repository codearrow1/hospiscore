import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listClaims } from "@/lib/saas/propertyClaims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/saas/claims?status=pending — admin claim inbox. */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PROPERTY_MANAGE")) {
    return NextResponse.json({ error: "PROPERTY_MANAGE required" }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const organizationId = req.nextUrl.searchParams.get("organizationId") ?? undefined;
  const claims = await listClaims({ status, organizationId });
  return NextResponse.json({ claims });
}
