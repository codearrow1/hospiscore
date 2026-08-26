import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EmailSettingsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Email Settings", "Platform access required.");
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) {
    return restrictedPanel("Email Settings", "Super Admin access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Email Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure SMTP server settings for email delivery. Changes are audited and take effect immediately.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">SMTP Configuration</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Connection details for the outbound email server. Passwords are stored encrypted.
        </p>
        <div className="mt-4">
          <SettingsPanel category="email" />
        </div>
      </section>
    </div>
  );
}
