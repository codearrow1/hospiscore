import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getAffiliate, updateAffiliateStatus } from "@/lib/saas/affiliates";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const { id } = await params;
  const aff = await getAffiliate(id);
  if (!aff) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  return NextResponse.json({ affiliate: aff });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_APPROVE")) return NextResponse.json({ error: "AFFILIATE_APPROVE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = String(body.status ?? "");
  try {
    const aff = await updateAffiliateStatus(id, status as never);
    await writeSaasAudit({ byEmail: guard.user.email, action: "affiliate.status_changed", entity: "affiliate", entityId: id, detail: status, ip: clientIp(req) });
    return NextResponse.json({ affiliate: aff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
