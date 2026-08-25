import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getCampaign, upsertPerformanceTier } from "@/lib/saas/campaigns";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ tiers: campaign.performanceTiers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const tier = await upsertPerformanceTier(id, {
      tierName: String(body.tierName ?? ""),
      minCustomers: body.minCustomers != null ? Number(body.minCustomers) : undefined,
      minMrr: body.minMrr != null ? Number(body.minMrr) : undefined,
      minRevenue: body.minRevenue != null ? Number(body.minRevenue) : undefined,
      commissionValue: body.commissionValue != null ? Number(body.commissionValue) : undefined,
      commissionModel: typeof body.commissionModel === "string" ? body.commissionModel : undefined,
      displayOrder: body.displayOrder != null ? Number(body.displayOrder) : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "campaign.tier_upserted", entity: "campaign", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ tier }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upsert failed" }, { status: 400 });
  }
}
