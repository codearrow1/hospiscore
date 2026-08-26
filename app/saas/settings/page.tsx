import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getApprovalRequirement, SETTING_REQUIRE_MARKETING_PRICING_APPROVAL } from "@/lib/saas/settings";
import PricingApprovalToggle from "@/components/saas/PricingApprovalToggle";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SaasSettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Settings", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Settings", "Super Admin access required.");
  }
  const enabled = await getApprovalRequirement();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          System-wide configuration. Changes are audited and take effect immediately.
        </p>
      </div>

      <section>
        <PricingApprovalToggle initialEnabled={enabled} />
        <p className="mt-2 text-xs text-zinc-400">
          Setting key: <code>{SETTING_REQUIRE_MARKETING_PRICING_APPROVAL}</code> · default when unset:{" "}
          <strong>enabled</strong> (financial safety first).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Billing &amp; Dunning</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Configure dunning retry schedules, grace periods, and invoice settings.
        </p>
        <div className="mt-4">
          <SettingsPanel category="billing" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Session, rate limiting, and portal claim token configuration.
        </p>
        <div className="mt-4">
          <SettingsPanel category="security" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Affiliate Defaults</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Global affiliate commission defaults, fraud thresholds, and payout settings.
        </p>
        <div className="mt-4">
          <SettingsPanel category="affiliate" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">SLA Targets</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Support ticket SLA targets by priority level.
        </p>
        <div className="mt-4">
          <SettingsPanel category="platform" />
        </div>
      </section>
    </div>
  );
}
