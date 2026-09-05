import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCommissions } from "@/lib/saas/commissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const affiliateId = req.nextUrl.searchParams.get("affiliateId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listCommissions({ affiliateId, status });
  return NextResponse.json({ commissions: items, total });
}
