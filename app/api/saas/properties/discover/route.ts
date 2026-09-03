import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { discoverProperties } from "@/lib/saas/propertyDiscovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/properties/discover?q=lisbon
 * Admin-only Google Places discovery. Each result is annotated with how it
 * relates to an existing HospiOS property (linked / duplicate / none).
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PROPERTY_MANAGE")) {
    return NextResponse.json({ error: "PROPERTY_MANAGE required" }, { status: 403 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const result = await discoverProperties(q);
  const status = result.ok ? 200 : 502;
  return NextResponse.json(result, { status });
}
