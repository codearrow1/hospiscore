import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { resolveCommissionRules } from "@/lib/saas/campaigns";
import { calcCommissionAmount } from "@/lib/saas/commissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const mrr = Number(body.mrr ?? 0);
  if (!mrr || mrr <= 0) return NextResponse.json({ error: "mrr required and must be > 0" }, { status: 400 });
  try {
    const rules = await resolveCommissionRules({
      campaignId: id,
      planSlug: typeof body.planSlug === "string" ? body.planSlug : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
    });
    if (!rules) return NextResponse.json({ error: "Campaign not found or not active" }, { status: 404 });
    const calculatedAmount = calcCommissionAmount(rules.model, rules.value, mrr);
    const maxCommission = rules.maxCommission;
    const finalAmount = maxCommission ? Math.min(calculatedAmount, maxCommission) : calculatedAmount;
    return NextResponse.json({
      model: rules.model,
      value: rules.value,
      calculatedAmount: finalAmount,
      holdingPeriodDays: rules.holdingPeriodDays,
      maxCommission: rules.maxCommission,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Simulation failed" }, { status: 400 });
  }
}
