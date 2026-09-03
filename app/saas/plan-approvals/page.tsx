import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listRequests } from "@/lib/saas/planSync";
import { prisma } from "@/lib/prisma";
import PlanApprovals, { type ApprovalRequestView } from "@/components/saas/PlanApprovals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Subscriber counts per plan power the approval impact summary. */
async function subscriberCountsByPlan(): Promise<Map<string, { subscribers: number; mrrCents: number }>> {
  const rows = await prisma.subscription.groupBy({
    by: ["planId"],
    where: { status: { in: ["active", "trial", "past_due", "grace"] } },
    _count: { _all: true },
    _sum: { mrr: true },
  });
  return new Map(rows.map((r) => [r.planId, { subscribers: r._count._all, mrrCents: r._sum.mrr ?? 0 }]));
}

export default async function PlanApprovalsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Plan approvals", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Plan approvals", "Super Admin access required.");
  }
  const [requests, counts] = await Promise.all([listRequests(), subscriberCountsByPlan()]);
  const views = requests as unknown as ApprovalRequestView[];
  const pendingCount = views.filter((r) => r.status === "pending").length;

  // Impact per request: who is on the plan today + what the price would become
  const impact: Record<string, { subscribers: number; mrrCents: number; newMonthly: number | null }> = {};
  for (const r of views) {
    const planId = r.planId ?? "";
    const c = counts.get(planId) ?? { subscribers: 0, mrrCents: 0 };
    const proposed = r.proposedSnapshot as { monthlyPrice?: unknown } | null;
    impact[r.id] = {
      subscribers: c.subscribers,
      mrrCents: c.mrrCents,
      newMonthly: proposed && typeof proposed.monthlyPrice === "number" ? proposed.monthlyPrice : null,
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          Pricing change approvals
          {pendingCount > 0 && (
            <span className="ml-3 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 align-middle text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {pendingCount} pending
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Proposed changes to canonical SaaS plans submitted by Marketing Admin.
          Approving applies the proposal to the plan and re-syncs the storefront
          baseline. Rejection requires a reason; every decision is audited.
        </p>
      </div>
      <PlanApprovals requests={views} isSuper impact={impact} />
    </div>
  );
}
