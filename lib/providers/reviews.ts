import type { PlatformKey, PlatformSignals } from "@/lib/types";
import { CONFIG } from "@/lib/config";
import { properties } from "@/lib/data";

/**
 * Review-data provider layer.
 *
 * Supplies OTA review signals (Booking, TripAdvisor, Expedia, Airbnb) for a
 * property. Google signals are handled separately by the Places provider.
 *
 * Providers are selected by `REVIEW_PROVIDER`:
 *   "demo"     → match against the seeded dataset (no network, works offline).
 *   "stayapi"  → StayAPI-style REST API.
 *   "apify"    → Apify actor REST API (pre-scheduled dataset).
 *
 * To add a provider: implement the `ReviewProvider` shape and register it in
 * `getReviewProvider()`.
 */

export interface ReviewProvider {
  id: string;
  fetchSignals(input: ReviewLookup): Promise<ReviewResult>;
}

export interface ReviewLookup {
  propertyName: string;
  placeId?: string;
  city?: string;
}

export interface ReviewResult {
  /** Which platforms we were able to resolve. */
  sources: PlatformKey[];
  /** OTA signals (google intentionally excluded). */
  platforms: Partial<Record<PlatformKey, PlatformSignals>>;
  /** True when the lookup hit a configured live provider. */
  live: boolean;
}

const OTAS: PlatformKey[] = [
  "booking",
  "tripadvisor",
  "expedia",
  "airbnb",
  "agoda",
  "hotels",
  "vrbo",
  "hostelworld",
  "trip",
];

/* ------------------------------- Demo ------------------------------- */

const demoProvider: ReviewProvider = {
  id: "demo",
  async fetchSignals({ propertyName }): Promise<ReviewResult> {
    // Match by normalized name so seeded demo properties enrich live searches.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = properties.find(
      (p) => norm(p.name) === norm(propertyName),
    );
    if (!match) {
      return { sources: [], platforms: {}, live: false };
    }
    const platforms: Partial<Record<PlatformKey, PlatformSignals>> = {};
    const sources: PlatformKey[] = [];
    for (const key of OTAS) {
      const signal = match.signals.platforms[key];
      if (signal?.present) {
        platforms[key] = signal;
        sources.push(key);
      }
    }
    return { sources, platforms, live: false };
  },
};

/* ------------------------------ StayAPI ----------------------------- */

/** Maps a normalized rating + count onto our PlatformSignals shape. */
function toSignals(
  rating: number | null,
  maxRating: number,
  reviewCount: number,
  recent30: number | null,
  responseRate: number | null,
): PlatformSignals | null {
  if (rating == null || !reviewCount) return null;
  return {
    present: true,
    rating,
    maxRating,
    reviewCount,
    reviewsRecent30:
      recent30 ?? Math.max(0, Math.round(reviewCount / 12)),
    responseRate: responseRate ?? 0.5, // unknown → neutral
  };
}

/**
 * StayAPI-style REST provider.
 *
 * Expected response shape (adapt to your plan's exact contract):
 *   GET {base}/hotels/{placeId}/reviews   headers: Authorization: Bearer {key}
 *   → { "reviews": { "booking": { count, recentCount, rating, maxRating, responseRate },
 *                    "tripadvisor": { ... }, "expedia": {...}, "airbnb": {...} } }
 */
const stayApiProvider: ReviewProvider = {
  id: "stayapi",
  async fetchSignals({ placeId }): Promise<ReviewResult> {
    if (!placeId) {
      throw new Error("StayAPI review lookup requires a Google placeId");
    }
    const url = `${CONFIG.reviewBaseUrl}/hotels/${encodeURIComponent(placeId)}/reviews`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CONFIG.reviewApiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Review provider failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as {
      reviews?: Record<string, {
        count?: number;
        recentCount?: number;
        rating?: number;
        maxRating?: number;
        ratingScale?: number;
        responseRate?: number;
      }>;
    };
    const platforms: Partial<Record<PlatformKey, PlatformSignals>> = {};
    const sources: PlatformKey[] = [];
    for (const key of OTAS) {
      const r = data.reviews?.[key];
      const signals = toSignals(
        r?.rating ?? null,
        r?.maxRating ?? r?.ratingScale ?? 10,
        r?.count ?? 0,
        r?.recentCount ?? null,
        r?.responseRate ?? null,
      );
      if (signals && r?.count) {
        platforms[key] = signals;
        sources.push(key);
      }
    }
    return { sources, platforms, live: true };
  },
};

/* ------------------------------- Apify ------------------------------ */

/** Placeholder mapping for an Apify actor's dataset (see README). */
const apifyProvider: ReviewProvider = {
  id: "apify",
  async fetchSignals(): Promise<ReviewResult> {
    // TODO(integration): call your scheduled Apify dataset's latest run via
    // the Apify API returns and reduce rows to per-platform signals here.
    return { sources: [], platforms: {}, live: false };
  },
};

/* ------------------------------ Registry ----------------------------- */

function getReviewProvider(): ReviewProvider {
  switch (CONFIG.reviewProvider) {
    case "stayapi":
      return stayApiProvider;
    case "apify":
      return apifyProvider;
    case "demo":
    default:
      return demoProvider;
  }
}

/** Public entry point. Falls back to demo on any live failure. */
export async function fetchReviewSignals(
  input: ReviewLookup,
): Promise<ReviewResult> {
  const provider = getReviewProvider();
  try {
    return await provider.fetchSignals(input);
  } catch (err) {
    // Degrade gracefully: a provider outage shouldn't blank the page.
    if (provider.id !== "demo") {
      const fallback = await demoProvider.fetchSignals(input);
      return { ...fallback, live: false };
    }
    console.error("Review provider error:", err);
    return { sources: [], platforms: {}, live: false };
  }
}