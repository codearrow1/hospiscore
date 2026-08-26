import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BillingSettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Billing Settings", "Platform access required.");
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) {
    return restrictedPanel("Billing Settings", "Finance Admin access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Dunning retry schedules, grace periods, trial duration, and invoice configuration.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Dunning &amp; Grace</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Configure how the system handles past-due payments and suspension timing.
        </p>
        <div className="mt-4">
          <SettingsPanel category="billing" />
        </div>
      </section>
    </div>
  );
}
