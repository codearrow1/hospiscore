import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";
import PropertyOnboardingWizard from "@/components/saas/PropertyOnboardingWizard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/saas/onboarding");

  if (!hasSaasPerm(user, "PROPERTY_MANAGE")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to onboard properties.</p>
      </div>
    );
  }

  return (
    <SettingsLayout
      title="Onboarding"
      description="Discover a Google listing, dedupe against existing properties, and import it as a hosted property."
    >
      <SettingsSection
        title="Discover & import a property"
        description="Search Google Places, review matches, then create/link the canonical Property and Organization."
      >
        <PropertyOnboardingWizard />
      </SettingsSection>
    </SettingsLayout>
  );
}
