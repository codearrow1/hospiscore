import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPartnerCommissions } from "@/lib/saas/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_VIEW")) return NextResponse.json({ error: "PARTNER_VIEW required" }, { status: 403 });
  const partnerId = req.nextUrl.searchParams.get("partnerId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listPartnerCommissions({ partnerId, status });
  return NextResponse.json({ commissions: items, total });
}
