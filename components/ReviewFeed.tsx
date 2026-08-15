import type { ReviewRecord } from "@/lib/nlp";
import { analyzeGuestReviews } from "@/lib/nlp";
import { classifyReview } from "@/lib/nlp";
import { ASPECT_LABEL } from "@/lib/nlp";
import { PLATFORM_NAMES } from "@/lib/types";
import ReplyGenerator from "@/components/ReplyGenerator";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm tabular-nums text-amber-400" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const TONE_STYLES = {
  positive:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  negative: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
} as const;

export default function ReviewFeed({
  reviews,
  propertyName,
}: {
  reviews: ReviewRecord[];
  propertyName: string;
}) {
  const intelligence = analyzeGuestReviews(reviews);

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
        No review text connected yet — attach a review provider to power live guest
        insight.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {intelligence.positiveCount} positive
        </span>
        <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          {intelligence.negativeCount} negative
        </span>
        <span className="text-zinc-400">{Math.round(intelligence.positiveRatio * 100)}% positive overall</span>
        <span className="ml-auto hidden text-zinc-400 sm:block">
          analyzed from {intelligence.totalReviews} reviews
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {reviews.map((r) => {
          const hits = classifyReview(r);
          return (
            <article
              key={r.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {PLATFORM_NAMES[r.platform]}
                </span>
                <Stars rating={r.rating} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                “{r.text}”
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hits.map((h) => (
                  <span
                    key={h.aspect}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_STYLES[h.tone]}`}
                  >
                    {ASPECT_LABEL[h.aspect]}
                  </span>
                ))}
              </div>
              {r.rating <= 3 && (
                <ReplyGenerator review={r} propertyName={propertyName} />
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}