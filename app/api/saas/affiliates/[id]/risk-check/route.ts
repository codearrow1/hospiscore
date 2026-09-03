import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { runRiskCheck } from "@/lib/saas/fraud";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/saas/affiliates/:id/risk-check
 * On-demand fraud re-scan for a single affiliate (see lib/saas/fraud.ts
 * runRiskCheck). Persists refreshed risk + opens a review case when flagged.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) {
    return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  }
  const { id } = await params;

  let result;
  try {
    result = await runRiskCheck(id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Risk check failed" }, { status: 404 });
  }

  await writeSaasAudit({
    byEmail: guard.user.email,
    action: "affiliate.risk_check",
    entity: "affiliate",
    entityId: id,
    detail: `riskScore=${result.riskScore}${result.caseId ? ` case=${result.caseId}` : ""}`,
    ip: clientIp(req),
  });

  return NextResponse.json(result);
}
