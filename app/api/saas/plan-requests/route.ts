import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasCapability } from "@/lib/marketing/roles";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listRequests, submitMarketingPlanChange } from "@/lib/saas/planSync";
import { clientIp } from "@/lib/marketing/guard";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/plan-requests
 *  GET  — Super Admin sees all requests; other roles see only their own.
 *  POST — propose a canonical-plan change. With the approval setting ON the
 *         change becomes a pending PlanChangeRequest; with OFF it applies
 *         immediately (still permission-checked and audited).
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const mineOnly = !hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE");
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const all = await listRequests(status || undefined);
  const rows = mineOnly ? all.filter((r) => r.requestedByEmail === user.email.toLowerCase()) : all;
  return NextResponse.json({ requests: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  // Marketing Admin needs pricing.manage; Super Admin may also use this route.
  const allowed =
    hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE") ||
    (hasCapability(user, "pricing.manage") ?? false);
  if (!allowed) return NextResponse.json({ error: "pricing.manage permission required" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const planId = String(body.planId ?? "");
  const patch = typeof body.patch === "object" && body.patch !== null ? (body.patch as Record<string, unknown>) : {};
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });

  const result = await submitMarketingPlanChange(user, planId, patch, reason);
  if (result.outcome === "error") return NextResponse.json({ error: result.error }, { status: 422 });
  await writeSaasAudit({
    byEmail: user.email,
    action: result.outcome === "pending" ? "plan.request_submitted" : "plan.updated_via_request_api",
    entity: "plan",
    entityId: planId,
    detail: Object.keys(patch).join(","),
    ip: clientIp(req),
  });
  return NextResponse.json(result, { status: result.outcome === "pending" ? 202 : 200 });
}
