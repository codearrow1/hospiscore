import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import ClaimsManager from "@/components/saas/ClaimsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ClaimsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canView = hasSaasPerm(user, "PROPERTY_VIEW");
  const canDecide = hasSaasPerm(user, "PROPERTY_MANAGE");
  if (!canView) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view property claims.</p>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Property Claims"
      description="Review ownership claims on Google listings and approve or reject them."
    >
      <SettingsSection
        title="Claims inbox"
        description="Pending listing claims awaiting review. Approving links the listing to the claiming organization's property record."
      >
        <ClaimsManager canDecide={canDecide} />
      </SettingsSection>
    </SettingsLayout>
  );
}
