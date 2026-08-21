import { NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { saasMetrics } from "@/lib/saas/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const m = await saasMetrics();
  return NextResponse.json(m);
}
