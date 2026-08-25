import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { initSaasDb } from "@/lib/saas/init";
import { detectFraud, createFraudCase } from "@/lib/saas/fraud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const result = await detectFraud(id);
    let caseCreated = false;
    if (result.shouldFlag) {
      await createFraudCase({ affiliateId: id, riskScore: result.riskScore, reasons: result.signals });
      caseCreated = true;
    }
    return NextResponse.json({ riskScore: result.riskScore, signals: result.signals, shouldFlag: result.shouldFlag, caseCreated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Risk check failed" }, { status: 400 });
  }
}
