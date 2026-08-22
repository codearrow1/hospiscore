import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listSubscriptions } from "@/lib/saas/subscriptions";
import { listOrganizations } from "@/lib/saas/organizations";
import { listPlans } from "@/lib/saas/plans";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";
import SubscriptionsManager from "@/components/saas/SubscriptionsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SubsPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Subscriptions", "Platform access required.");
  const [{ items, total }, orgs, plans] = await Promise.all([
    listSubscriptions({ take: 200 }),
    listOrganizations({ take: 100 }),
    listPlans({ includeArchived: true }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Subscriptions</h1>
      <p className="text-sm text-zinc-500">{total} subscriptions across all markets — each keeps its own charged currency and amount. Lifecycle: trial → active → past_due → grace → suspended → cancelled → expired (+ paused).</p>
      <SubscriptionsManager
        initialSubs={items as never[]}
        orgs={orgs.items.map((o) => ({ id: o.id, legalName: o.legalName, country: (o as unknown as { country?: string | null }).country ?? null }))}
        plans={plans.map((p) => ({ id: p.id, name: p.name, slug: p.slug, isCustomPrice: (p as unknown as { isCustomPrice?: boolean }).isCustomPrice, isActive: (p as unknown as { isActive?: boolean }).isActive }))}
        countries={SEED_COUNTRIES.map((c) => ({ code: c.code, name: c.name, currency: c.currency }))}
      />
    </div>
  );
}
