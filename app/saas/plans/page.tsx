import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listPlans, seedDefaultPlans } from "@/lib/saas/plans";
import PlansManager from "@/components/saas/PlansManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlansPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Plans", "Platform access required.");
  await seedDefaultPlans();
  const plans = await listPlans();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plans</h1>
        <p className="mt-1 text-sm text-zinc-500">Configurable SaaS plans — monthly/annual prices, trial, limits, features. No hard-coded names — create, edit, deactivate here.</p>
      </div>
      <PlansManager initialPlans={plans as never[]} />
    </div>
  );
}
