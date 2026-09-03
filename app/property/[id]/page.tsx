import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePropertyById } from "@/lib/resolver";
import PropertyScoreView from "@/components/PropertyScoreView";
import PropertyClaimCTA from "@/components/PropertyClaimCTA";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LivePropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const property = await resolvePropertyById(decoded);
  if (!property) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to search
        </Link>
        <PropertyScoreView property={property} />
        {decoded.startsWith("place:") && (
          <div className="mt-6">
            <PropertyClaimCTA slug={decoded} />
          </div>
        )}
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiScore · Hospitality OS
      </footer>
    </div>
  );
}