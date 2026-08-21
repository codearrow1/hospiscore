import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listSubscriptions } from "@/lib/saas/subscriptions";
import { listOrganizations } from "@/lib/saas/organizations";
import { listPlans } from "@/lib/saas/plans";
import SubscriptionsManager from "@/components/saas/SubscriptionsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SubsPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Subscriptions", "Platform access required.");
  const [{ items, total }, orgs, plans] = await Promise.all([listSubscriptions({ take: 100 }), listOrganizations({ take: 100 }), listPlans()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Subscriptions</h1>
      <p className="text-sm text-zinc-500">{total} subscriptions — lifecycle: trial → active → past_due → grace → suspended → cancelled → expired (+ paused). All transitions audited.</p>
      <SubscriptionsManager initialSubs={items as never[]} orgs={orgs.items.map((o)=>({id:o.id, legalName:o.legalName}))} plans={plans.map((p)=>({id:p.id, name:p.name, slug:p.slug}))} />
    </div>
  );
}
