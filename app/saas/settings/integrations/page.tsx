import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function IntegrationsSettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Integrations", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Integrations", "Super Admin access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          API keys and third-party service configuration. Secrets are stored securely.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">API Keys &amp; Services</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Configure external service credentials. Values marked as secrets are masked in the UI.
        </p>
        <div className="mt-4">
          <SettingsPanel category="integration" />
        </div>
      </section>
    </div>
  );
}
