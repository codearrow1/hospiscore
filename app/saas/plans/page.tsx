import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listPlans, seedDefaultPlans } from "@/lib/saas/plans";
import { listRequests } from "@/lib/saas/planSync";
import { hasSaasPerm } from "@/lib/saas/roles";
import PlansManager from "@/components/saas/PlansManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlansPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Plans", "Platform access required.");
  await seedDefaultPlans();
  const [plans, pending] = await Promise.all([
    listPlans(),
    listRequests("pending"),
  ]);
  const byPlan = new Map<string, number>();
  for (const r of pending as { planId: string; requestedByEmail: string }[]) {
    byPlan.set(r.planId, (byPlan.get(r.planId) ?? 0) + 1);
  }
  const isSuper = hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plans</h1>
        <p className="mt-1 text-sm text-zinc-500">Configurable SaaS plans — monthly/annual prices, trial, limits, features. No hard-coded names — create, edit, deactivate here.</p>
      </div>
      {byPlan.size > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <span className="font-medium text-amber-800 dark:text-amber-300">Pending pricing approvals:</span>{" "}
          {plans
            .filter((p) => byPlan.has((p as unknown as { id: string }).id))
            .map((p) => {
              const plain = p as unknown as { id: string; name: string };
              return `${plain.name} (${byPlan.get(plain.id)})`;
            })
            .join(", ") || `${byPlan.size} request(s)`}
          {isSuper && (
            <Link href="/saas/plan-approvals" className="ml-2 font-semibold text-indigo-700 underline dark:text-indigo-300">
              Review now →
            </Link>
          )}
        </div>
      )}
      <PlansManager initialPlans={plans as never[]} />
    </div>
  );
}
