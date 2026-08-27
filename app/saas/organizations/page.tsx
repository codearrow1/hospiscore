import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import OrganizationList from "@/components/saas/OrganizationList";
import NewOrgModal from "@/components/saas/NewOrgModal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const autoOpen = sp?.new === "1";

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
        <div className="mb-4 flex justify-end">
          <NewOrgModal autoOpen={autoOpen} />
        </div>
        <OrganizationList />
      </SettingsSection>
    </SettingsLayout>
  );
}
