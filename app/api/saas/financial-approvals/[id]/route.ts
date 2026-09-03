import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import {
  getFinancialApprovalDetail,
  approveFinancialApproval,
  rejectFinancialApproval,
  cancelFinancialApproval,
} from "@/lib/saas/financialApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/financial-approvals/:id — detail incl. CURRENT target state
 *   and material differences from the requested snapshot (blocking if any).
 * PATCH — { decision: "approve" } executes the canonical action;
 *         { decision: "reject", reason } rejects;
 *         { decision: "cancel" } withdraws (requester or approver).
 * Approve/reject require FINANCIAL_APPROVE. Reply mechanserver-enforces
 * requester ≠ approver.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE") && !hasSaasPerm(guard.user, "AUDIT_VIEW")) {
    return NextResponse.json({ error: "FINANCIAL_APPROVE or AUDIT_VIEW required" }, { status: 403 });
  }
  const { id } = await params;
  const detail = await getFinancialApprovalDetail(id);
  if (!detail) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : body.decision === "cancel" ? "cancel" : "";
  if (!decision) return NextResponse.json({ error: "decision must be approve|reject|cancel" }, { status: 400 });

  let result;
  if (decision === "approve") {
    result = await approveFinancialApproval(id, guard.user, clientIp(req));
  } else if (decision === "reject") {
    if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE")) {
      return NextResponse.json({ error: "FINANCIAL_APPROVE required" }, { status: 403 });
    }
    result = await rejectFinancialApproval(id, guard.user, typeof body.reason === "string" ? body.reason : "", clientIp(req));
  } else {
    result = await cancelFinancialApproval(id, { email: guard.user.email, role: guard.user.role }, clientIp(req));
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
