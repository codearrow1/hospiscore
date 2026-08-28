import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getFinancialApprovalDetail, ACTION_LABELS } from "@/lib/saas/financialApproval";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { FinancialApproval } from "@/lib/generated/prisma/client";
import FinancialApprovalDetail, { type DetailApproval } from "@/components/saas/FinancialApprovalDetail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FinancialApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Financial approval", "Platform access required.");
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE") && !hasSaasPerm(guard.user, "AUDIT_VIEW")) {
    return restrictedPanel("Financial approval", "FINANCIAL_APPROVE or AUDIT_VIEW required.");
  }
  const { id } = await params;
  const detail = await getFinancialApprovalDetail(id);
  if (!detail) notFound();

  const a = detail.approval as FinancialApproval & { snapshot: Record<string, unknown> | null };
  const approval: DetailApproval = {
    id: a.id,
    actionType: a.actionType,
    targetType: a.targetType,
    targetId: a.targetId,
    amountMinor: a.amountMinor,
    currency: a.currency,
    requesterEmail: a.requesterEmail,
    reviewerEmail: a.reviewerEmail,
    status: a.status,
    reason: a.reason,
    decisionReason: a.decisionReason,
    requestedAt: new Date(a.requestedAt).toISOString(),
    approvedAt: a.approvedAt ? new Date(a.approvedAt).toISOString() : null,
    rejectedAt: a.rejectedAt ? new Date(a.rejectedAt).toISOString() : null,
    cancelledAt: a.cancelledAt ? new Date(a.cancelledAt).toISOString() : null,
    expiredAt: a.expiredAt ? new Date(a.expiredAt).toISOString() : null,
    executedAt: a.executedAt ? new Date(a.executedAt).toISOString() : null,
    failedAt: a.failedAt ? new Date(a.failedAt).toISOString() : null,
    expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString() : null,
    executionError: a.executionError,
    snapshot: a.snapshot,
  };

  const org = a.organizationId
    ? await prisma.organization.findUnique({ where: { id: a.organizationId }, select: { id: true, legalName: true, businessName: true, country: true } })
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <FinancialApprovalDetail
        approval={approval}
        current={detail.current ? (detail.current as unknown as Record<string, unknown>) : null}
        differences={detail.differences}
        actionLabel={ACTION_LABELS[a.actionType as keyof typeof ACTION_LABELS] ?? a.actionType}
        canApprove={detail.canApprove && hasSaasPerm(guard.user, "FINANCIAL_APPROVE")}
        viewerEmail={guard.user.email}
        organization={org}
      />
    </div>
  );
}
