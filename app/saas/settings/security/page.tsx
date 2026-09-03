import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SecuritySettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Security Settings", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Security Settings", "Super Admin access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Session lifetime, rate limiting, and portal claim token configuration.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Sessions &amp; Rate Limiting</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Control how long sessions persist and how many requests clients can make.
        </p>
        <div className="mt-4">
          <SettingsPanel category="security" />
        </div>
      </section>
    </div>
  );
}
