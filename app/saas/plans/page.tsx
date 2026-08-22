import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listPlans, seedDefaultPlans } from "@/lib/saas/plans";
import { listRequests } from "@/lib/saas/planSync";
import { listCountryPrices } from "@/lib/saas/pricingSync";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";
import PlansManager from "@/components/saas/PlansManager";
import CountryPricingMatrix from "@/components/saas/CountryPricingMatrix";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlansPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Plans", "Platform access required.");
  await seedDefaultPlans();
  const isSuper = hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE");
  const [plans, pending, countryPrices] = await Promise.all([
    listPlans({ includeArchived: true }),
    listRequests("pending"),
    listCountryPrices().catch(() => []),
  ]);
  const byPlan = new Map<string, number>();
  for (const r of pending as { planId: string | null; requestedByEmail: string }[]) {
    if (r.planId) byPlan.set(r.planId, (byPlan.get(r.planId) ?? 0) + 1);
  }
  return (
    <div className="space-y-6">
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

      <div>
        <h2 className="text-lg font-bold">Global pricing catalog</h2>
        <p className="mb-2 mt-1 text-sm text-zinc-500">
          Every active plan in every market ({SEED_COUNTRIES.length} countries), priced in the local currency. Editing a price syncs the Marketing storefront automatically.
        </p>
        <CountryPricingMatrix initialPrices={countryPrices as never[]} countries={SEED_COUNTRIES.map((c) => ({ code: c.code, name: c.name, currency: c.currency }))} canEdit={hasSaasPerm(guard.user, "PLAN_MANAGE")} />
      </div>
    </div>
  );
}
