import type { PlatformSignals, Property, RawSignals } from "@/lib/types";
import { computeScore } from "@/lib/scoring";
import { CONFIG } from "@/lib/config";
import { properties, findProperty } from "@/lib/data";
import { searchPlaces, getPlaceDetails, type PlaceMatch } from "@/lib/providers/google";
import { fetchReviewSignals } from "@/lib/providers/reviews";
import { loadReviewRecords } from "@/lib/reviewIngest";
import { analyzeGuestReviews, qualitySignalsFromGuest, type ReviewRecord } from "@/lib/nlp";

/**
 * Orchestrates data sources into scored properties.
 *
 *  demo mode → returns the seeded dataset (server-side copy of the old client logic).
 *  live mode → Google Places search + review provider, enriched into scoring signals.
 */

export interface SearchResult {
  id: string; // demo slug, or `place:<placeId>`
  slug: string;
  name: string;
  city: string;
  country: string;
  type: string;
  claimed: boolean;
  overall: number;
  platformsCount: number;
  totalReviews: number;
  isLive: boolean;
}

function cityFromAddress(address: string): { city: string; country: string } {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const country = parts.length > 0 ? parts[parts.length - 1] : "";
  // Prefer the segment just before the country (usually the city/region).
  const city = parts.length > 1 ? parts[parts.length - 2] : country;
  return { city, country };
}

function presenceFromPlace(place: PlaceMatch): RawSignals["presence"] {
  const hasWebsite = Boolean(place.websiteUri);
  return {
    gbpCompleteness: hasWebsite ? 0.85 : 0.55,
    websiteQuality: hasWebsite ? 70 : 35,
    socialScore: 0, // not exposed by Places — provider or manual entry required
    directoryListings: 1,
    localPackVisible: false,
  };
}

function googleSignalFromPlace(place: PlaceMatch) {
  if (place.rating == null || !place.userRatingCount) return undefined;
  return {
    present: true,
    rating: place.rating,
    maxRating: 5,
    reviewCount: place.userRatingCount,
    reviewsRecent30: Math.max(0, Math.round(place.userRatingCount / 12)),
    responseRate: 0.5, // unknown → neutral
  };
}

/** Merge Places -> google + provider -> OTA platforms into one signals map. */
function buildSignals(
  place: PlaceMatch,
  ota: Partial<Record<string, PlatformSignals>>,
  reviews: ReviewRecord[] = [],
): RawSignals {
  const google = googleSignalFromPlace(place);
  const quality = reviews.length > 0
    ? qualitySignalsFromGuest(analyzeGuestReviews(reviews))
    : undefined;
  return {
    platforms: {
      ...(google ? { google } : {}),
      ...ota,
    } as Partial<Record<string, PlatformSignals>> as RawSignals["platforms"],
    presence: presenceFromPlace(place),
    quality,
  };
}

function toSearchResult(prop: Property, isLive: boolean): SearchResult {
  const result = computeScore(prop.signals);
  return {
    id: isLive ? `place:${prop.slug}` : prop.slug,
    slug: prop.slug,
    name: prop.name,
    city: prop.city,
    country: prop.country,
    type: prop.type,
    claimed: prop.claimed,
    overall: result.overall,
    platformsCount: result.platformsCount,
    totalReviews: result.totalReviews,
    isLive,
  };
}

/** Resolve a live Google place (id in the form `place:<placeId>`). */
async function resolveLive(place: PlaceMatch): Promise<Property> {
  const ota = await fetchReviewSignals({
    propertyName: place.name,
    placeId: place.placeId,
    city: cityFromAddress(place.address).city,
  });
  const reviews = await loadReviewRecords({
    propertyName: place.name,
    placeId: place.placeId,
    city: cityFromAddress(place.address).city,
  });
  const signals = buildSignals(place, ota.platforms, reviews);
  const type = place.types.includes("lodging") ? "Hotel" : "Property";
  return {
    slug: `place:${place.placeId}`,
    name: place.name,
    city: cityFromAddress(place.address).city,
    country: cityFromAddress(place.address).country,
    type,
    claimed: false,
    color: "indigo",
    signals,
  };
}

/** Primary search. Returns rich search results. */
export async function searchProperties(query: string): Promise<SearchResult[]> {
  if (CONFIG.live) {
    if (!query.trim()) return []; // live mode: require a query
    try {
      const places = await searchPlaces(query, 8);
      const results: SearchResult[] = [];
      // Enrich only the top few to keep latency + Places quota reasonable.
      for (const place of places.slice(0, 5)) {
        const prop = await resolveLive(place);
        results.push(toSearchResult(prop, true));
      }
      return results;
    } catch (err) {
      console.error("Live search failed, falling back to demo:", err);
      return searchDemo(query);
    }
  }
  return searchDemo(query); // demo mode: empty query lists the whole dataset
}

function searchDemo(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  return properties
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q),
    )
    .map((p) => toSearchResult(p, false));
}

/** Resolve a full property by id (demo slug or `place:<placeId>`). */
export async function resolvePropertyById(id: string): Promise<Property | null> {
  if (id.startsWith("place:")) {
    if (!CONFIG.live) return null;
    const placeId = id.slice("place:".length);
    try {
      const place = await getPlaceDetails(placeId);
      return resolveLive(place);
    } catch (err) {
      console.error("Live resolve failed:", err);
      return null;
    }
  }
  // demo slug path
  return findProperty(id) ?? null;
}