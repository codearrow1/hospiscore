import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { cancelPlanChange } from "@/lib/saas/planSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/saas/plan-requests/:id/cancel — requester only, while pending. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const result = await cancelPlanChange(id, guard.user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
