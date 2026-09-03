import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { resolveAppRole } from "@/lib/rbac";
import { initSaasDb } from "@/lib/saas/init";
import { resolveOrgForUser } from "@/lib/saas/portalAccess";
import { getCustomerSubscriptionOverview } from "@/lib/saas/customerSubscription";
import CustomerSubscriptionClient from "@/components/saas/CustomerSubscriptionClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Customer Subscription Self-Service — plan switch, cancellation, renewal. */
export default async function CustomerSubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/customer/subscription");
  await initSaasDb().catch(() => {});

  const resolved = await resolveOrgForUser(user);
  if (!resolved) {
    const appRole = await resolveAppRole(user);
    if (appRole !== "super_admin") redirect("/account?next=/customer/subscription");
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="mt-2 text-sm text-zinc-600">
          No customer account found for {user.email}. Contact your account manager to get set up.
        </p>
      </div>
    );
  }

  const overview = await getCustomerSubscriptionOverview(resolved.organizationId, resolved.contactId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your plan, pricing, and renewal from here. Changes submitted by your team
          are reviewed and applied by our billing team.
        </p>
      </div>
      <CustomerSubscriptionClient overview={overview} />
    </div>
  );
}
