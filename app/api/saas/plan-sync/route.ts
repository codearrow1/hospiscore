import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { pricingSyncStatus, ensureDefaultPlanLinks } from "@/lib/saas/planSync";
import { syncBaselineAfterPlanChange } from "@/lib/saas/planSync";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/plan-sync — Super Admin only.
 * GET  → drift report between canonical Plan prices and the storefront baseline.
 * POST → reconcile the baseline for every linked plan from canonical prices.
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
  return NextResponse.json(await pricingSyncStatus());
}

export async function POST(req: NextRequest) {
  const guard = await superOnly();
  if (!guard.ok) return guard.response;
  const { prisma } = await import("@/lib/prisma");
  await ensureDefaultPlanLinks().catch(() => {});
  const links = await prisma.planLink.findMany({ select: { planId: true } });
  for (const l of links) {
    await syncBaselineAfterPlanChange(l.planId, guard.user.email).catch(() => {});
  }
  const status = await pricingSyncStatus();
  await writeSaasAudit({
    byEmail: guard.user.email,
    action: "pricing.baseline_reconciled",
    entity: "plan",
    detail: `${links.length} linked plans checked`,
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true, links: links.length, drift: status.drift });
}
