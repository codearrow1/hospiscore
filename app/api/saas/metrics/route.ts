import { NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { saasMetrics } from "@/lib/saas/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  const m = await saasMetrics();
  return NextResponse.json(m);
}
