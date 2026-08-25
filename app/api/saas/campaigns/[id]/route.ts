import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getCampaign, updateCampaign } from "@/lib/saas/campaigns";
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
  return NextResponse.json({ campaign });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const campaign = await updateCampaign(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      commissionModel: typeof body.commissionModel === "string" ? body.commissionModel as never : undefined,
      commissionValue: body.commissionValue != null ? Number(body.commissionValue) : undefined,
      recurringDuration: body.recurringDuration != null ? Number(body.recurringDuration) : undefined,
      recurringLimit: body.recurringLimit !== undefined ? (body.recurringLimit != null ? Number(body.recurringLimit) : null) : undefined,
      cookieDays: body.cookieDays != null ? Number(body.cookieDays) : undefined,
      attributionModel: typeof body.attributionModel === "string" ? body.attributionModel as never : undefined,
      holdingPeriodDays: body.holdingPeriodDays != null ? Number(body.holdingPeriodDays) : undefined,
      maxCommission: body.maxCommission !== undefined ? (body.maxCommission != null ? Number(body.maxCommission) : null) : undefined,
      minPayout: body.minPayout != null ? Number(body.minPayout) : undefined,
      tier2OverrideRate: body.tier2OverrideRate != null ? Number(body.tier2OverrideRate) : undefined,
      tier3OverrideRate: body.tier3OverrideRate != null ? Number(body.tier3OverrideRate) : undefined,
      overrideFundingModel: typeof body.overrideFundingModel === "string" ? body.overrideFundingModel : undefined,
      maxTierDepth: body.maxTierDepth != null ? Number(body.maxTierDepth) : undefined,
      planOverrides: typeof body.planOverrides === "object" ? body.planOverrides as Record<string, unknown> : undefined,
      countryOverrides: typeof body.countryOverrides === "object" ? body.countryOverrides as Record<string, unknown> : undefined,
      fraudRules: typeof body.fraudRules === "object" ? body.fraudRules as Record<string, unknown> : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "campaign.updated", entity: "campaign", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ campaign });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
