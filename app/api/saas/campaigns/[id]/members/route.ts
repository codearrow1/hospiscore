import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCampaignMembers, assignAffiliateToCampaign } from "@/lib/saas/campaigns";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const { id } = await params;
  const members = await listCampaignMembers(id);
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const affiliateId = String(body.affiliateId ?? "");
  if (!affiliateId || typeof body.affiliateId !== "string") return NextResponse.json({ error: "affiliateId required" }, { status: 400 });
  if (body.customRate !== undefined && body.customRate !== null && body.customRate !== "") {
    const n = Number(body.customRate);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "customRate must be a non-negative number" }, { status: 400 });
  }
  try {
    const member = await assignAffiliateToCampaign(affiliateId, id, {
      customRate: body.customRate != null ? Number(body.customRate) : undefined,
      assignedBy: guard.user.email,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "campaign.member_added", entity: "campaign", entityId: id, detail: affiliateId, ip: clientIp(req) });
    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Assign failed" }, { status: 400 });
  }
}
