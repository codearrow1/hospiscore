import Link from "next/link";
import { notFound } from "next/navigation";
import { findProperty } from "@/lib/data";
import { computeScore } from "@/lib/scoring";
import Header from "@/components/Header";
import ClaimForm from "@/components/ClaimForm";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prop = findProperty(decodeURIComponent(slug));
  if (!prop) notFound();

  const result = computeScore(prop.signals);
  const [worst] = [...result.components].sort((a, b) => a.score - b.score);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/properties/${prop.slug}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {prop.name}
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Claim {prop.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Verify you own this property to unlock review-response tracking and a
            prioritized action plan. Your current score is{" "}
            <strong className="text-zinc-900 dark:text-zinc-50">{result.overall}</strong>{" "}
            ({result.grade}) — weakest signal:{" "}
            <strong className="text-zinc-900 dark:text-zinc-50">
              {worst.label.toLowerCase()}
            </strong>
            .
          </p>

          <div className="my-6 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            {[
              {
                title: "Step 1 — Confirm your identity",
                body: "We verify against your Google Business Profile or your on-file PMS contact.",
              },
              {
                title: "Step 2 — Connect review sources",
                body: "Attach your Booking, TripAdvisor and Expedia accounts so we can read full review history.",
              },
              {
                title: "Step 3 — Get the action plan",
                body: "See prioritized fixes ranked by score impact, plus response-rate tracking.",
              },
            ].map((s) => (
              <div key={s.title} className="flex gap-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {s.title}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.body}</div>
                </div>
              </div>
            ))}
          </div>

          <ClaimForm slug={prop.slug} propertyName={prop.name} />
        </div>
      </main>
    </div>
  );
}