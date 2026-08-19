import Link from "next/link";
import type { Property } from "@/lib/types";
import { computeScore } from "@/lib/scoring";
import { getScoreStore } from "@/lib/scoreHistory";
import ScoreGauge from "@/components/ScoreGauge";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import ScoreRadar from "@/components/ScoreRadar";
import BenchmarkPanel from "@/components/BenchmarkPanel";
import PlatformRatings from "@/components/PlatformRatings";
import ReviewFeed from "@/components/ReviewFeed";
import ScoreTrend from "@/components/ScoreTrend";
import PropertyReport from "@/components/PropertyReport";
import SavePropertyButton from "@/components/SavePropertyButton";
import ReportEmailForm from "@/components/ReportEmailForm";
import { loadReviewRecords } from "@/lib/reviewIngest";
import { datasetBenchmark } from "@/lib/benchmark";
import { buildReport } from "@/lib/report";

export default async function PropertyScoreView({
  property: prop,
}: {
  property: Property;
}) {
  const result = computeScore(prop.signals);
  const benchmark = datasetBenchmark();
  const report = buildReport(prop.name, prop.signals);
  const [worst] = [...result.components].sort((a, b) => a.score - b.score);

  const history = await getScoreStore().history(prop.slug);
  const reviews = await loadReviewRecords({
    propertyName: prop.name,
    slug: prop.slug,
    city: prop.city,
  });
  const trend =
    history.length >= 2
      ? {
          change: history[history.length - 1].overall - history[0].overall,
          points: history.length,
          latest: history[history.length - 1].overall,
        }
      : undefined;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {prop.name}
            </h1>
            {prop.claimed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified owner
              </span>
            )}
          </div>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {prop.type} · {prop.city}, {prop.country}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            Score computed {new Date(result.date).toLocaleDateString()} ·{" "}
            {result.totalReviews.toLocaleString()} reviews across{" "}
            {result.platformsCount} platforms · weighted rating{" "}
            {result.averageRating}/100 · {result.dataCompleteness}% data coverage
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
          <SavePropertyButton slug={prop.slug} />
          {!prop.claimed && (
            <Link
              href={`/properties/${prop.slug}/claim`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              Claim this property
            </Link>
          )}
        </div>
      </div>

      <section className="print-block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="mx-auto w-full shrink-0 text-center lg:mx-0 lg:w-56">
            <ScoreGauge score={result.overall} size={170} />
            <h2 className="mt-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Online presence score
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {worst.score < 50
                ? `Priority: ${worst.label.toLowerCase()} is your weakest signal.`
                : "Healthy across the board — keep responding to reviews to sustain it."}
            </p>
            <Link
              href={`/properties/${prop.slug}/claim`}
              className="mt-4 inline-block rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {prop.claimed ? "View owner dashboard" : "Claim to see recommendations"}
            </Link>
          </div>

          <div className="flex-1 border-t border-zinc-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Signal profile
            </h3>
            <div className="mt-2 text-zinc-500 dark:text-zinc-400">
              <ScoreRadar components={result.components} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <ReportEmailForm propertySlug={prop.slug} propertyName={prop.name} />
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <PropertyReport
          propertyName={prop.name}
          headline={report.headline}
          strengths={report.strengths}
          watchouts={report.watchouts}
          risks={report.risks}
          servicesPositive={report.servicesPositive}
          servicesNegative={report.servicesNegative}
          platformsCount={report.platformsCount}
          totalReviews={report.totalReviews}
          market={report.market}
          trend={trend}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Score breakdown
        </h2>
        <ScoreBreakdown result={result} />
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Vs market
        </h2>
        <BenchmarkPanel result={result} benchmark={benchmark} />
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Reviews by platform
        </h2>
        <PlatformRatings platforms={prop.signals.platforms} />
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          What guests are saying
        </h2>
        <ReviewFeed reviews={reviews} propertyName={prop.name} />
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ScoreTrend propertyId={prop.slug} />
      </section>
    </>
  );
}