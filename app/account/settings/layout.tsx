import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import AccountSettingsLayout from "@/components/account/AccountSettingsLayout";

export const metadata = {
  title: "Account Settings · HospiOS",
  description: "Manage your account settings and preferences.",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/account/settings");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <AccountSettingsLayout user={user}>
          {children}
        </AccountSettingsLayout>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiOS · Hospitality OS
      </footer>
    </div>
  );
}
