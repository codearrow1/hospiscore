import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/account/ProfileForm";

export const metadata = {
  title: "Profile · Account Settings",
  description: "Manage your personal information.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/account/settings/profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your personal information and public profile.
        </p>
      </div>
      <ProfileForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        }}
      />
    </div>
  );
}
