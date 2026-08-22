import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listRequests } from "@/lib/saas/planSync";
import PlanApprovals, { type ApprovalRequestView } from "@/components/saas/PlanApprovals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlanApprovalsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Plan approvals", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Plan approvals", "Super Admin access required.");
  }
  const requests = (await listRequests()) as unknown as ApprovalRequestView[];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pricing change approvals</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Proposed changes to canonical SaaS plans submitted by Marketing Admin.
          Approving applies the proposal to the plan and re-syncs the storefront
          baseline. Rejection requires a reason; every decision is audited.
        </p>
      </div>
      <PlanApprovals requests={requests} isSuper />
    </div>
  );
}
