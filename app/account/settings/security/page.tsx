import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import SecurityForm from "@/components/account/SecurityForm";

export const metadata = {
  title: "Security · Account Settings",
  description: "Manage your password and security settings.",
};

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/account/settings/security");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your password and security preferences.
        </p>
      </div>
      <SecurityForm userId={user.id} />
    </div>
  );
}
