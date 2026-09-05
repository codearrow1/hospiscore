import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getApprovalRequirement, SETTING_REQUIRE_MARKETING_PRICING_APPROVAL } from "@/lib/saas/settings";
import PricingApprovalToggle from "@/components/saas/PricingApprovalToggle";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Platform settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          System-wide toggles. Changes are audited and take effect immediately.
        </p>
      </div>
      <PricingApprovalToggle initialEnabled={enabled} />
      <p className="text-xs text-zinc-400">
        Setting key: <code>{SETTING_REQUIRE_MARKETING_PRICING_APPROVAL}</code> · default when unset:{" "}
        <strong>enabled</strong> (financial safety first).
      </p>
    </div>
  );
}
