import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCampaigns, createCampaign } from "@/lib/saas/campaigns";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const { items, total } = await listCampaigns({ status, q });
  return NextResponse.json({ campaigns: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const campaign = await createCampaign({
      name: String(body.name ?? ""),
      slug: typeof body.slug === "string" ? body.slug : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      commissionModel: typeof body.commissionModel === "string" ? body.commissionModel as never : undefined,
      commissionValue: body.commissionValue != null ? Number(body.commissionValue) : undefined,
      recurringDuration: body.recurringDuration != null ? Number(body.recurringDuration) : undefined,
      recurringLimit: body.recurringLimit != null ? Number(body.recurringLimit) : undefined,
      cookieDays: body.cookieDays != null ? Number(body.cookieDays) : undefined,
      attributionModel: typeof body.attributionModel === "string" ? body.attributionModel as never : undefined,
      holdingPeriodDays: body.holdingPeriodDays != null ? Number(body.holdingPeriodDays) : undefined,
      maxCommission: body.maxCommission != null ? Number(body.maxCommission) : undefined,
      minPayout: body.minPayout != null ? Number(body.minPayout) : undefined,
      tier2OverrideRate: body.tier2OverrideRate != null ? Number(body.tier2OverrideRate) : undefined,
      tier3OverrideRate: body.tier3OverrideRate != null ? Number(body.tier3OverrideRate) : undefined,
      overrideFundingModel: typeof body.overrideFundingModel === "string" ? body.overrideFundingModel : undefined,
      maxTierDepth: body.maxTierDepth != null ? Number(body.maxTierDepth) : undefined,
      planOverrides: typeof body.planOverrides === "object" && body.planOverrides !== null ? body.planOverrides as Record<string, unknown> : undefined,
      countryOverrides: typeof body.countryOverrides === "object" && body.countryOverrides !== null ? body.countryOverrides as Record<string, unknown> : undefined,
      fraudRules: typeof body.fraudRules === "object" && body.fraudRules !== null ? body.fraudRules as Record<string, unknown> : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "campaign.created", entity: "campaign", entityId: campaign.id, ip: clientIp(req) });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
