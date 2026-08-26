import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AffiliateSettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Affiliate Settings", "Platform access required.");
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) {
    return restrictedPanel("Affiliate Settings", "Marketing Admin access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Affiliate Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Commission models, fraud thresholds, payout configuration, and cookie settings.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Commission &amp; Fraud</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Global defaults for affiliate commissions, fraud detection, and payout rules.
        </p>
        <div className="mt-4">
          <SettingsPanel category="affiliate" />
        </div>
      </section>
    </div>
  );
}
