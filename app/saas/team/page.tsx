import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import TeamManager from "@/components/saas/TeamManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage team settings.</p>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Team Management"
      description="View and manage platform team members and their roles."
    >
      <SettingsSection
        title="Team Members"
        description="Search, view, and update roles for all platform users."
      >
        <TeamManager />
      </SettingsSection>
    </SettingsLayout>
  );
}
