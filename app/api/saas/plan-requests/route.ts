import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasCapability } from "@/lib/marketing/roles";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listRequests, submitMarketingPlanChange, REQUEST_ACTIONS } from "@/lib/saas/planSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/plan-requests
 *  GET  — Super Admin sees all requests; other roles see only their own.
 *  POST — propose a canonical-plan change or structural action
 *         (update|create|archive|activate|deactivate). With the approval
 *         setting ON the proposal becomes a pending PlanChangeRequest; with
 *         OFF it applies immediately (still permission-checked and audited).
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
  const planId = body.planId ? String(body.planId) : undefined;
  const patch = typeof body.patch === "object" && body.patch !== null ? (body.patch as Record<string, unknown>) : {};
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const rawAction = typeof body.action === "string" ? body.action : "update";
  if (!(REQUEST_ACTIONS as readonly string[]).includes(rawAction)) {
    return NextResponse.json({ error: `action must be one of ${REQUEST_ACTIONS.join("|")}` }, { status: 400 });
  }
  if (!planId && rawAction !== "create") {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }

  const result = await submitMarketingPlanChange({
    user,
    action: rawAction,
    planId,
    patch,
    reason,
    ip: clientIp(req),
  });
  if (result.outcome === "error") return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json(result, { status: result.outcome === "pending" ? 202 : 200 });
}
