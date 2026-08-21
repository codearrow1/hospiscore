import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listDunningCases } from "@/lib/saas/dunning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_VIEW")) return NextResponse.json({ error: "BILLING_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listDunningCases({ status });
  return NextResponse.json({ cases: items, total });
}
