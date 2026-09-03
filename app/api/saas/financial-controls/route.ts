import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getFinancialControlsSettings, saveFinancialControlsSettings, type FinancialControlsSettings } from "@/lib/saas/financialApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/saas/financial-controls
 * Read/Update the four-eyes financial policy (SystemSetting "financial_controls").
 * Only FINANCIAL_APPROVE (super_admin / platform_admin) may view or change it.
 */
export async function GET(_req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE")) return NextResponse.json({ error: "FINANCIAL_APPROVE required" }, { status: 403 });
  return NextResponse.json({ settings: await getFinancialControlsSettings() });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE")) return NextResponse.json({ error: "FINANCIAL_APPROVE required" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const settings = body as Partial<FinancialControlsSettings>;
  if (typeof settings !== "object" || settings === null) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }
  try {
    const saved = await saveFinancialControlsSettings(settings as FinancialControlsSettings, guard.user.email);
    return NextResponse.json({ settings: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 400 });
  }
}
