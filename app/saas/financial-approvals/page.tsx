import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listFinancialApprovals, ACTION_LABELS } from "@/lib/saas/financialApproval";
import { prisma } from "@/lib/prisma";
import FinancialApprovalQueue from "@/components/saas/FinancialApprovalQueue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FinancialApprovalsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Financial approvals", "Platform access required.");
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE") && !hasSaasPerm(guard.user, "AUDIT_VIEW")) {
    return restrictedPanel("Financial approvals", "FINANCIAL_APPROVE or AUDIT_VIEW required.");
  }

  const { items } = await listFinancialApprovals({ take: 200 });

  const orgIds = [...new Set(items.map((r) => r.organizationId).filter(Boolean) as string[])];
  const orgs = orgIds.length
    ? await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, legalName: true, businessName: true, country: true } })
    : [];
  const orgMap = new Map(orgs.map((o) => [o.id, o]));

  const views = items.map((r) => ({
    id: r.id,
    actionType: r.actionType,
    actionLabel: ACTION_LABELS[r.actionType as keyof typeof ACTION_LABELS] ?? r.actionType,
    targetType: r.targetType,
    targetId: r.targetId,
    amountMinor: r.amountMinor,
    currency: r.currency,
    requesterEmail: r.requesterEmail,
    status: r.status,
    reason: r.reason,
    decisionReason: r.decisionReason,
    reviewerEmail: r.reviewerEmail,
    requestedAt: new Date(r.requestedAt).toISOString(),
    approvedAt: r.approvedAt ? new Date(r.approvedAt).toISOString() : null,
    rejectedAt: r.rejectedAt ? new Date(r.rejectedAt).toISOString() : null,
    expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    executedAt: r.executedAt ? new Date(r.executedAt).toISOString() : null,
    executionError: r.executionError,
    organization: r.organizationId ? orgMap.get(r.organizationId) ?? null : null,
  }));

  const pendingCount = views.filter((r) => r.status === "pending").length;
  const highValueCount = views.filter((r) => r.status === "pending" && r.amountMinor >= 10_000_00).length;
  const expiringCount = views.filter((r) => r.status === "pending" && r.expiresAt && Date.parse(r.expiresAt) - Date.now() < 36 * 3_600_000).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          Financial approvals
          {pendingCount > 0 && (
            <span className="ml-3 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {pendingCount} pending
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Four-eyes review for high-risk financial actions (invoice void, refund, payout release). The requester and
          approver must be different users — self-approval is blocked server-side. Approving may execute the financial
          action immediately.
        </p>
      </div>
      <FinancialApprovalQueue
        initial={views}
        counts={{ pending: pendingCount, highValue: highValueCount, expiring: expiringCount }}
        canApprove={hasSaasPerm(guard.user, "FINANCIAL_APPROVE")}
        viewerEmail={guard.user.email}
      />
    </div>
  );
}
