import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listSubscriptionChangeRequests } from "@/lib/saas/subscriptionPlan";
import { prisma } from "@/lib/prisma";
import SubscriptionChangeApprovals from "@/components/saas/SubscriptionChangeApprovals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SubscriptionRequestsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Subscription approvals", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_VIEW")) {
    return restrictedPanel("Subscription approvals", "SUBSCRIPTION_VIEW required.");
  }

  const requests = await listSubscriptionChangeRequests({ take: 200 });
  const orgIds = [...new Set(requests.map((r) => r.organizationId).filter(Boolean) as string[])];
  const planIds = [...new Set(requests.flatMap((r) => [r.fromPlanId, r.toPlanId]).filter(Boolean) as string[])];
  const [orgs, plans] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, legalName: true, businessName: true, country: true } }),
    prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }),
  ]);
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const planMap = new Map(plans.map((p) => [p.id, p]));

  const views = requests.map((r) => ({
    id: r.id,
    status: r.status,
    requestedByEmail: r.requestedByEmail,
    createdAt: new Date(r.createdAt).toISOString(),
    reviewedByEmail: r.reviewedByEmail,
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    rejectionReason: r.rejectionReason,
    reason: r.reason,
    organization: r.organizationId ? orgMap.get(r.organizationId) ?? null : null,
    fromPlan: r.fromPlanId ? planMap.get(r.fromPlanId) ?? null : null,
    toPlan: r.toPlanId ? planMap.get(r.toPlanId) ?? null : null,
    billingCycle: r.billingCycle,
    proposedSnapshot: r.proposedSnapshot as { currency?: string; prorationDeltaMinor?: number; unitAmount?: number | null } | null,
  }));

  const pendingCount = views.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          Subscription plan approvals
          {pendingCount > 0 && (
            <span className="ml-3 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {pendingCount} pending
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Plan-change requests submitted by customer teams via the subscription self-service portal.
          Approving applies the switch through the canonical billing service (proration + renewal handled);
          every decision is audited.
        </p>
      </div>
      <SubscriptionChangeApprovals initial={views} />
    </div>
  );
}
