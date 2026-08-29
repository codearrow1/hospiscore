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
          A note on SMTP: outbound email is driven by environment variables configured on the server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). The fields shown below are stored for reference but do not change runtime delivery — configure them at the host instead.
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
