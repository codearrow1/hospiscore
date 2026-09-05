import { NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { auditPricingPlanSync } from "@/lib/saas/planCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/plan-sync/audit — read-only consistency report between the
 * Marketing pricing catalog and the canonical SaaS Plan table. Super Admin only.
 */
export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AUDIT_VIEW") && !hasSaasPerm(guard.user, "PLAN_MANAGE")) {
    return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
  }
  return NextResponse.json(await auditPricingPlanSync());
}
