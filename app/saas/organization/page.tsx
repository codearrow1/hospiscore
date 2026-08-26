import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import OrgDefaultsForm from "@/components/saas/OrgDefaultsForm";

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

  await initSaasDb().catch((e) => console.error("[org-settings] db init failed:", e?.message ?? e));

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
      description="Manage platform-wide organization defaults and view statistics."
    >
      <SettingsSection
        title="Organization Defaults"
        description="Default values applied when creating new organizations."
      >
        <OrgDefaultsForm />
      </SettingsSection>

      <SettingsSection
        title="Platform Statistics"
        description="Current state of organizations on the platform."
      >
        <div className="grid gap-4 sm:grid-cols-3">
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
      </SettingsSection>
    </SettingsLayout>
  );
}
