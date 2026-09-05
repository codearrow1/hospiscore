import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listUsers } from "@/lib/marketing/users";
import { MARKETING_ROLES, ROLE_LABELS } from "@/lib/marketing/roles";
import { CONFIG } from "@/lib/config";
import SettingsManager from "@/components/marketing-admin/SettingsManager";
import { SectionCard } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SettingsPage() {
  const guard = await requireCapability("settings.manage");
  if (!guard.ok) {
    return restrictedPanel("Settings", "You need settings.manage permission to change team and settings.");
  }
  await ensureMarketingStore();

  const users = await listUsers();

  const envConfig: Record<string, string> = {
    "ADMIN_EMAILS": CONFIG.adminEmails.join(", ") || "(none)",
    "SALES_EMAIL": CONFIG.salesEmail,
    "DEMO_MEETING_URL": CONFIG.demoMeetingUrl,
    "TRACK_VIEWS": CONFIG.trackViews ? "on" : "off",
    "Public rate limit": `${CONFIG.publicRateMax} / ${(CONFIG.publicRateWindowMs / 1000).toFixed(0)}s per visitor`,
    "Admin rate limit": `${CONFIG.adminRateMax} / min per admin`,
    "Data provider": CONFIG.dataProvider,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Marketing team, role access and runtime configuration.
        </p>
      </div>

      <SettingsManager
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))}
        roles={MARKETING_ROLES.map((r) => ({ id: r, label: ROLE_LABELS[r] }))}
        config={envConfig}
      />

      <SectionCard title="Role capabilities">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="pb-2 pr-3 font-semibold">Role</th>
                <th className="pb-2 font-semibold">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {MARKETING_ROLES.map((role) => (
                <tr key={role} className="align-top border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-2.5 pr-3 font-semibold">{ROLE_LABELS[role]}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {ROLE_CAPS[role].map((c) => (
                        <span key={c} className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

const ROLE_CAPS: Record<string, string[]> = {
  super_admin: ["access", "leads.read", "leads.write", "leads.manage", "demos.manage", "campaigns.manage", "forms.manage", "content.manage", "pricing.manage", "analytics.read", "settings.manage", "audit.read"],
  marketing_admin: ["access", "leads.read", "leads.write", "leads.manage", "demos.manage", "campaigns.manage", "forms.manage", "content.manage", "pricing.manage", "analytics.read", "settings.manage", "audit.read"],
  marketing_manager: ["access", "leads.read", "leads.write", "demos.manage", "campaigns.manage", "forms.manage", "content.manage", "analytics.read"],
  sales_manager: ["access", "leads.read", "leads.write", "leads.manage", "demos.manage", "analytics.read"],
  sales_rep: ["access", "leads.read", "leads.write", "demos.manage"],
  content_editor: ["access", "content.manage", "analytics.read"],
  seo_manager: ["access", "content.manage", "analytics.read"],
  analyst: ["access", "leads.read", "analytics.read"],
};