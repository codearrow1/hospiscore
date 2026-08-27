import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import OrganizationList from "@/components/saas/OrganizationList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrganizationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasSaasPerm(user, "CUSTOMER_VIEW")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view organizations.</p>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Organizations"
      description="View and manage all customer organizations on the platform."
    >
      <SettingsSection
        title="All Organizations"
        description="Search and filter organizations by name, country, or status."
      >
        <OrganizationList />
      </SettingsSection>
    </SettingsLayout>
  );
}
