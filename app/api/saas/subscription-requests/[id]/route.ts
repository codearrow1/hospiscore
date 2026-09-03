import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { approveSubscriptionChange, rejectSubscriptionChange } from "@/lib/saas/subscriptionPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/saas/subscription-requests/:id
 *   { decision: "approve" }                         — apply the plan switch
 *   { decision: "reject", reason }                   — reject (reason required)
 * Requires SUBSCRIPTION_MANAGE. Applying executes the canonical changePlan().
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_MANAGE")) return NextResponse.json({ error: "SUBSCRIPTION_MANAGE required" }, { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : "";
  if (!decision) return NextResponse.json({ error: "decision must be approve|reject" }, { status: 400 });

  let result;
  if (decision === "approve") {
    result = await approveSubscriptionChange(id, guard.user, clientIp(req));
  } else {
    result = await rejectSubscriptionChange(id, guard.user, typeof body.reason === "string" ? body.reason : "", clientIp(req));
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
