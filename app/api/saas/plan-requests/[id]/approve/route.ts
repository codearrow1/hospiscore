import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { approvePlanChange } from "@/lib/saas/planSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/saas/plan-requests/:id/approve — Super Admin only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const result = await approvePlanChange(id, guard.user, clientIp(req));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, planId: result.planId });
}
