import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getPricingDoc } from "@/lib/pricing/db";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";
import { listPlans } from "@/lib/saas/plans";
import { getRequestsForEmail } from "@/lib/saas/planSync";
import { getApprovalRequirement } from "@/lib/saas/settings";
import PricingManager from "@/components/pricing/PricingManager";
import PlanProposalPanel, {
  type ProposalPlanView,
  type ProposalRequestView,
} from "@/components/pricing/PlanProposalPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PricingAdminPage() {
  const guard = await requireCapability("pricing.manage");
  if (!guard.ok) {
    return restrictedPanel("Pricing", "You need pricing.manage permission to edit pricing.");
  }

  const [doc, plans, requests, approvalRequired] = await Promise.all([
    getPricingDoc(),
    listPlans().catch(() => []),
    (async () => {
      
      return getRequestsForEmail(guard.user.email);
    })(),
    getApprovalRequirement().catch(() => true),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Localized pricing</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Country profiles, taxes, gateways and prices. Saving creates a new
          version — existing subscriptions keep theirs. This is the
          finance-authoritative source used by the public pricing pages.
        </p>
      </div>
      <PricingManager initial={doc} seeds={[...SEED_COUNTRIES]} />
      <PlanProposalPanel
        approvalRequired={approvalRequired}
        plans={plans as unknown as ProposalPlanView[]}
        requests={requests as unknown as ProposalRequestView[]}
      />
    </div>
  );
}
