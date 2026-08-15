import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findProperty } from "@/lib/data";
import { computeScore } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/sessionCookie";
import Header from "@/components/Header";

function recommendations(
  components: { key: string; label: string; score: number }[],
): { priority: "high" | "medium" | "low"; title: string; body: string }[] {
  const map: Record<string, { title: string; body: string }> = {
    ratingQuality: {
      title: "Improve guest satisfaction",
      body: "Low ratings are the heaviest-weighted signal. Run post-stay surveys and resolve recurring complaints from negative reviews.",
    },
    reviewVolume: {
      title: "Generate more reviews",
      body: "Volume below the 300-review target. Automate review requests after checkout on your top channel.",
    },
    reviewVelocity: {
      title: "Steady the review flow",
      body: "Recent reviews signal an active property. Ask for reviews within 24h of checkout to keep velocity high.",
    },
    responseRate: {
      title: "Answer every review",
      body: "A low response rate signals neglect. Respond to 100% of negative and at least 20% of positive reviews.",
    },
    platformDiversity: {
      title: "Add more platforms",
      body: "Reviews concentrated on one platform look less credible. Claim listings on Booking, TripAdvisor and Google.",
    },
    presence: {
      title: "Strengthen your profile",
      body: "Complete your Google Business Profile, fix your website (SSL/mobile), and sync directory listings.",
    },
    guestExperience: {
      title: "Harden the guest experience",
      body: "Low service, cleanliness or value scores drag your rating. Review recurring complaints and invest in the two weakest dimensions.",
    },
    amenities: {
      title: "Bullet for amenities",
      body: "Boost the amenities you advertise — clear wifi, parking, dining and facilities copy builds trust and sturdier bookings.",
    },
    visualContent: {
      title: "Refresh your photos & media",
      body: "Poor or sparse imagery lowers appeal. Publish bright, current photos in the same quality across every channel.",
    },
    sustainability: {
      title: "Showcase sustainability",
      body: "Guest choice increasingly rewards eco practices. Surface certifications, recycling, energy measures and local sourcing.",
    },
    accessibility: {
      title: "Improve accessibility",
      body: "Low accessibility coverage excludes guests with disabilities. Document step-free access, adaptations and clear policies.",
    },
    directBookings: {
      title: "Build direct bookings",
      body: "Heavy OTA dependence hurts margins. Drive booking-engine traffic and offers to shift share to your own channels.",
    },
    brandTrust: {
      title: "Align with your class",
      body: "Guests notice when a property over-promises. Match advertising to delivered quality and pursue industry recognition.",
    },
  };

  return components.map((c) => {
    const rec = map[c.key];
    return {
      priority: (c.score < 50 ? "high" : c.score < 70 ? "medium" : "low") as
        | "high"
        | "medium"
        | "low",
      title: rec.title,
      body: rec.body,
    };
  });
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
  medium: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  low: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/account");

  const prop = findProperty(decodeURIComponent(slug));
  if (!prop) notFound();

  const result = computeScore(prop.signals);
  const recs = recommendations(result.components).sort(
    (a, b) => rank(a.priority) - rank(b.priority),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href={`/properties/${prop.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to score
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Verified owner
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Owner dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {prop.name} · Score {result.overall}/100 ({result.grade})
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {result.dataCompleteness}% data coverage — recommendations weight only
          measured criteria.
        </p>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Prioritized action plan
          </h2>
          <div className="flex flex-col gap-3">
            {recs.map((r) => (
              <div
                key={r.title}
                className={`rounded-2xl border p-5 ${PRIORITY_STYLES[r.priority]}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {r.priority}
                  </span>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{r.title}</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{r.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          In production this panel adds: response-rate tracking, weekly score alerts,
          sentiment analysis and competitor benchmarking.
        </div>
      </main>
    </div>
  );
}

function rank(p: "high" | "medium" | "low") {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}