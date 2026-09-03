import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { runSettlement, listFranchisePayouts } from "@/lib/saas/franchisePayouts";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/saas/franchise/settlement?period=YYYY-MM — list payouts for a period.
 * POST /api/saas/franchise/settlement { period } — run settlement for a period.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_VIEW")) return NextResponse.json({ error: "FRANCHISE_VIEW required" }, { status: 403 });
  const period = req.nextUrl.searchParams.get("period") || undefined;
  const franchiseeId = req.nextUrl.searchParams.get("franchiseeId") || undefined;
  const payouts = await listFranchisePayouts({ period, franchiseeId });
  return NextResponse.json({ payouts });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_MANAGE")) return NextResponse.json({ error: "FRANCHISE_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const period = typeof body.period === "string" ? body.period : "";
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: "Period must be YYYY-MM" }, { status: 400 });

  try {
    const results = await runSettlement(period);
    const created = results.filter((r) => r.created);
    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "franchise.settlement_run",
      entity: "franchise_payout",
      detail: `Period ${period}: ${created.length} payout(s) created, ${results.length - created.length} already settled`,
      ip: clientIp(req),
    });
    return NextResponse.json({ period, results, created: created.length, skipped: results.length - created.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Settlement failed" }, { status: 400 });
  }
}
