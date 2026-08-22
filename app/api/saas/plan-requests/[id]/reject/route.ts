import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { rejectPlanChange } from "@/lib/saas/planSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/saas/plan-requests/:id/reject — Super Admin only, reason required. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await rejectPlanChange(guard.user, id, String(body.reason ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
