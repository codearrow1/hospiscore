import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import PropertyList from "@/components/saas/PropertyList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PropertiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasSaasPerm(user, "PROPERTY_VIEW")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view properties.</p>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Properties"
      description="View and manage properties across all organizations."
    >
      <SettingsSection
        title="All Properties"
        description="Select an organization to view its properties."
      >
        <PropertyList />
      </SettingsSection>
    </SettingsLayout>
  );
}
