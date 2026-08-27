import { NextRequest, NextResponse } from "next/server";
import { originAllowed } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { listClaimsByOrg } from "@/lib/saas/propertyClaims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/customer/properties/claims — the caller's organization's claims. */
export async function GET(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const claims = await listClaimsByOrg(access.org.organizationId);
  return NextResponse.json({ claims });
}
