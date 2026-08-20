import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import PricingManager from "@/components/pricing/PricingManager";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin } from "@/lib/leads";
import { getPricingDoc } from "@/lib/pricing/db";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Pricing manager · HospiOS",
  description: "Internal localized pricing management.",
};

export default async function PricingAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/account/pricing");

  if (!isAdmin(user)) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pricing manager
          </h1>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              This area is restricted to the HospiOS team. If you should have
              access, sign in with an admin account or ask an administrator to
              add your e-mail to{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                ADMIN_EMAILS
              </code>
              .
            </p>
          </div>
        </main>
        <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          HospiOS · Hospitality OS
        </footer>
      </div>
    );
  }

  const doc = await getPricingDoc();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to account
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pricing manager
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Edit local prices, taxes, gateways and country availability. Every
            save creates a new pricing version; existing subscriptions keep
            the version they were created on.
          </p>
        </div>

        <PricingManager initial={doc} seeds={[...SEED_COUNTRIES]} />
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiOS · Hospitality OS
      </footer>
    </div>
  );
}