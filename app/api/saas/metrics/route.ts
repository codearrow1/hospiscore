import { NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { saasMetrics } from "@/lib/saas/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Company-wide revenue metrics — restricted to billing/marketing viewers. */
export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_VIEW") && !hasSaasPerm(guard.user, "MARKETING_VIEW")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const m = await saasMetrics();
  return NextResponse.json(m);
}
