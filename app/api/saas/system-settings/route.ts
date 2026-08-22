import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import {
  getApprovalRequirement,
  setApprovalRequirement,
  SETTING_REQUIRE_MARKETING_PRICING_APPROVAL,
} from "@/lib/saas/settings";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/system-settings — Super Admin only.
 * GET  → approval requirement + key name.
 * PUT  → { requireMarketingPricingApproval: boolean } toggles the setting.
 */
async function superOnly() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return { ok: false as const, response: NextResponse.json({ error: "Super Admin access required" }, { status: 403 }) };
  }
  return guard;
}

export async function GET() {
  const guard = await superOnly();
  if (!guard.ok) return guard.response;
  return NextResponse.json({
    [SETTING_REQUIRE_MARKETING_PRICING_APPROVAL]: await getApprovalRequirement(),
  });
}

export async function PUT(req: NextRequest) {
  const guard = await superOnly();
  if (!guard.ok) return guard.response;
  let body: { requireMarketingPricingApproval?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const value = body.requireMarketingPricingApproval;
  if (typeof value !== "boolean") {
    return NextResponse.json({ error: "requireMarketingPricingApproval must be a boolean" }, { status: 400 });
  }
  await setApprovalRequirement(value, guard.user.email);
  await writeSaasAudit({
    byEmail: guard.user.email,
    action: "system.setting_changed",
    entity: "feature_flag",
    entityId: SETTING_REQUIRE_MARKETING_PRICING_APPROVAL,
    detail: `requireMarketingPricingApproval=${value}`,
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true, [SETTING_REQUIRE_MARKETING_PRICING_APPROVAL]: value });
}
