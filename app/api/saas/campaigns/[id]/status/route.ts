import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updateCampaignStatus } from "@/lib/saas/campaigns";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = String(body.status ?? "");
  try {
    const campaign = await updateCampaignStatus(id, status as never);
    await writeSaasAudit({ byEmail: guard.user.email, action: "campaign.status_changed", entity: "campaign", entityId: id, detail: status, ip: clientIp(req) });
    return NextResponse.json({ campaign });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
