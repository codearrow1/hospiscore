import PreferencesForm from "@/components/account/PreferencesForm";

export const metadata = {
  title: "Preferences · Account Settings",
  description: "Manage your timezone, date format, and appearance preferences.",
};

export default function PreferencesPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">Preferences</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Customize your experience across HospiOS.
      </p>
      <div className="mt-6">
        <PreferencesForm />
      </div>
    </div>
  );
}
