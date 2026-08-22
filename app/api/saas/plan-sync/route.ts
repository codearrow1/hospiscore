import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { auditPricingPlanSync, reconcilePlans } from "@/lib/saas/planCatalog";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/plan-sync — Super Admin only.
 * GET  → full consistency audit (read-only).
 * POST → dry-run reconciliation by default; `{"apply":true}` executes the
 *        deterministic action plan (CREATE/UPDATE/MAP/ARCHIVE/REPAIR).
 */
async function superOnly() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard;
  if (!hasSaasPerm(guard.user, "PLAN_MANAGE")) {
    return { ok: false as const, response: NextResponse.json({ error: "Super Admin access required" }, { status: 403 }) };
  }
  return guard;
}

export async function GET() {
  const guard = await superOnly();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await auditPricingPlanSync());
}

export async function POST(req: NextRequest) {
  const guard = await superOnly();
  if (!guard.ok) return guard.response;
  let apply = false;
  try {
    const body = (await req.json()) as { apply?: unknown };
    apply = body?.apply === true;
  } catch {
    // no body → dry run
  }
  const report = await reconcilePlans({ dryRun: !apply });
  if (apply) {
    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "pricing.catalog_reconciled",
      entity: "plan",
      detail: `${report.applied} actions applied`,
      ip: clientIp(req),
    });
  }
  return NextResponse.json(report);
}
