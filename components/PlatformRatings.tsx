import type { PlatformKey, PlatformSignals } from "@/lib/types";
import { PLATFORM_NAMES } from "@/lib/types";
import { TOTAL_PLATFORMS } from "@/lib/scoring";

export default function PlatformRatings({
  platforms,
}: {
  platforms: Partial<Record<PlatformKey, PlatformSignals>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {TOTAL_PLATFORMS.map((key) => {
        const data = platforms[key];
        return (
          <div
            key={key}
            className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {PLATFORM_NAMES[key]}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {data?.present
                  ? `${data.reviewCount.toLocaleString()} reviews`
                  : "No listing found"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {data?.present
                  ? `${data.rating.toFixed(1)}/${data.maxRating}`
                  : "—"}
              </div>
              {data?.present && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {data.reviewsRecent30} in 30d
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
