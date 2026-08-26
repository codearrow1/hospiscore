import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection, SettingsField, SettingsInput, SettingsSelect, SettingsToggle } from "@/components/settings/SettingsUI";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrganizationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE") && !hasSaasPerm(user, "CUSTOMER_MANAGE")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage organization settings.</p>
      </div>
    );
  }

  const orgCount = await prisma.organization.count();
  const countryCount = await prisma.organization.findMany({
    where: { country: { not: null } },
    select: { country: true },
    distinct: ["country"],
  });

  const industries = await prisma.organization.findMany({
    where: { industry: { not: null } },
    select: { industry: true },
    distinct: ["industry"],
  });

  return (
    <SettingsLayout
      title="Organization Settings"
      description="Manage platform-wide organization defaults and policies."
    >
      <SettingsSection
        title="Organization Defaults"
        description="Default values applied to new organizations."
      >
        <SettingsField label="Default Country" description="Pre-selected country for new organizations.">
          <SettingsSelect
            value=""
            onChange={() => {}}
            options={[
              { value: "", label: "(No default)" },
              { value: "US", label: "United States" },
              { value: "GB", label: "United Kingdom" },
              { value: "IN", label: "India" },
              { value: "ZA", label: "South Africa" },
              { value: "AE", label: "UAE" },
            ]}
          />
        </SettingsField>

        <SettingsField label="Default Currency" description="Billing currency for new subscriptions.">
          <SettingsSelect
            value="USD"
            onChange={() => {}}
            options={[
              { value: "USD", label: "USD — US Dollar" },
              { value: "EUR", label: "EUR — Euro" },
              { value: "GBP", label: "GBP — British Pound" },
              { value: "INR", label: "INR — Indian Rupee" },
              { value: "ZAR", label: "ZAR — South African Rand" },
              { value: "AED", label: "AED — UAE Dirham" },
            ]}
          />
        </SettingsField>

        <SettingsField label="Default Timezone" description="Timezone for date/time display.">
          <SettingsSelect
            value="UTC"
            onChange={() => {}}
            options={[
              { value: "UTC", label: "UTC" },
              { value: "America/New_York", label: "Eastern Time (US)" },
              { value: "America/Los_Angeles", label: "Pacific Time (US)" },
              { value: "Europe/London", label: "London (GMT)" },
              { value: "Asia/Kolkata", label: "India (IST)" },
              { value: "Asia/Dubai", label: "Dubai (GST)" },
              { value: "Africa/Johannesburg", label: "South Africa (SAST)" },
            ]}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Platform Statistics"
        description="Current state of organizations on the platform."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
            <dt className="text-xs font-bold uppercase tracking-wide text-zinc-400">Total Organizations</dt>
            <dd className="mt-1 text-2xl font-bold">{orgCount}</dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
            <dt className="text-xs font-bold uppercase tracking-wide text-zinc-400">Countries Active</dt>
            <dd className="mt-1 text-2xl font-bold">{countryCount.length}</dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
            <dt className="text-xs font-bold uppercase tracking-wide text-zinc-400">Industries</dt>
            <dd className="mt-1 text-2xl font-bold">{industries.length}</dd>
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          These are read-only statistics. Organization defaults will be configurable via SystemSetting in Phase D.
        </p>
      </SettingsSection>
    </SettingsLayout>
  );
}
