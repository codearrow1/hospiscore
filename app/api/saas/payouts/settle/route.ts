import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { initSaasDb } from "@/lib/saas/init";
import { runSettlementBatch } from "@/lib/saas/payoutEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_PAYOUT")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const campaignId = typeof body.campaignId === "string" ? body.campaignId : undefined;
  try {
    const result = await runSettlementBatch({ campaignId });
    await writeSaasAudit({ byEmail: user.email, action: "payout.settlement_run", entity: "payout", entityId: campaignId ?? "all", ip: clientIp(req) });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Settlement failed" }, { status: 400 });
  }
}
