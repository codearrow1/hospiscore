import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listFinancialApprovals, requestFinancialApproval, isFinancialActionType } from "@/lib/saas/financialApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/financial-approvals — four-eyes approval queue.
 *   ?status=&actionType=&requesterEmail=&currency=&take=&skip=
 * Viewers: FINANCIAL_APPROVE (approvers) or AUDIT_VIEW (auditors/finance).
 * POST — request a financial approval for a high-risk action.
 *   { actionType, targetId, reason }
 * The requester must hold the action's own execution permission.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE") && !hasSaasPerm(guard.user, "AUDIT_VIEW")) {
    return NextResponse.json({ error: "FINANCIAL_APPROVE or AUDIT_VIEW required" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;
  const actionType = sp.get("actionType") ?? undefined;
  const requesterEmail = sp.get("requesterEmail") ?? undefined;
  const currency = sp.get("currency") ?? undefined;
  const takeNum = Number(sp.get("take") ?? 50);
  const skipNum = Number(sp.get("skip") ?? 0);
  const { items, total } = await listFinancialApprovals({
    status,
    actionType,
    requesterEmail,
    currency,
    take: Number.isFinite(takeNum) ? takeNum : 50,
    skip: Number.isFinite(skipNum) ? skipNum : 0,
  });
  return NextResponse.json({ approvals: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const actionType = String(body.actionType ?? "");
  if (!isFinancialActionType(actionType)) {
    return NextResponse.json({ error: "actionType must be invoice.void|payment.refund|payout.release" }, { status: 400 });
  }
  const targetId = String(body.targetId ?? "");
  if (!targetId) return NextResponse.json({ error: "targetId is required" }, { status: 400 });

  const result = await requestFinancialApproval({
    actionType,
    targetId,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    requester: guard.user,
    requesterUserId: (guard.user as { id?: string }).id,
    ip: clientIp(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
