import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import NotificationsForm from "@/components/account/NotificationsForm";

export const metadata = {
  title: "Notifications · Account Settings",
  description: "Manage your notification preferences.",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/account/settings/notifications");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose how and when you want to be notified.
        </p>
      </div>
      <NotificationsForm userId={user.id} />
    </div>
  );
}
