import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getApprovalRequirement, SETTING_REQUIRE_MARKETING_PRICING_APPROVAL } from "@/lib/saas/settings";
import PricingApprovalToggle from "@/components/saas/PricingApprovalToggle";
import SettingsPanel from "@/components/saas/SettingsPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SETTING_PAGES = [
  { href: "/saas/settings/billing", label: "Billing & Dunning", desc: "Retry schedules, grace periods, invoices", color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  { href: "/saas/settings/security", label: "Security", desc: "Sessions, rate limits, portal tokens", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { href: "/saas/settings/affiliate", label: "Affiliate Program", desc: "Commissions, fraud, payouts", color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" },
  { href: "/saas/settings/email", label: "Email (SMTP)", desc: "Outbound email server", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { href: "/saas/settings/integrations", label: "Integrations", desc: "API keys and services", color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  { href: "/saas/settings/financial", label: "Financial Controls", desc: "Four-eyes dual-approval policy", color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
  { href: "/saas/settings/payments", label: "Payment Providers", desc: "Gateways, routing, fees, secrets", color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
];

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
        <h2 className="text-lg font-semibold">Platform General</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Admin emails, sales contacts, SLA targets, health scoring, and org defaults.
        </p>
        <div className="mt-4">
          <SettingsPanel category="platform" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Settings Pages</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Dedicated configuration pages for specific subsystems.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SETTING_PAGES.map((p) => (
            <a
              key={p.href}
              href={p.href}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/10"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${p.color}`}>
                {p.label[0]}
              </span>
              <div>
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="text-xs text-zinc-500">{p.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
