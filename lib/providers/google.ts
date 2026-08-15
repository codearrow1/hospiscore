import { CONFIG } from "@/lib/config";
import { cacheOrCompute, cacheKey } from "@/lib/cache";

/**
 * Google Places API (v1 / "Places API New") provider.
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Two calls:
 *  1. Text Search   → candidate properties for a free-text query.
 *  2. Place Details → full signals for one `place_id`.
 *
 * Every method throws with a clear message when the API key is missing or the
 * upstream call fails, so callers can fall back to demo mode cleanly.
 */

export interface PlaceMatch {
  placeId: string;
  name: string;
  address: string;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
}

const PLACES_BASE = "https://places.googleapis.com/v1";

function headers() {
  if (!CONFIG.googlePlacesApiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set");
  }
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": CONFIG.googlePlacesApiKey,
  };
}

const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
].join(",");

/** Text Search: find property candidates for a free-text query. */
export async function searchPlaces(query: string, limit = 8): Promise<PlaceMatch[]> {
  return cacheOrCompute(
    cacheKey(["places", "search", query, String(limit)]),
    () => searchPlacesLive(query, limit),
    60 * 60, // 1h
  );
}

async function searchPlacesLive(query: string, limit: number): Promise<PlaceMatch[]> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: { ...headers(), "X-Goog-FieldMask": SEARCH_FIELDS },
    body: JSON.stringify({
      textQuery: query,
      pageSize: limit,
      includedType: "lodging",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Places text search failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      types?: string[];
      rating?: number;
      userRatingCount?: number;
      websiteUri?: string;
    }>;
  };

  return (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "Unknown property",
    address: p.formattedAddress ?? "",
    types: p.types ?? [],
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    websiteUri: p.websiteUri ?? null,
  }));
}

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "types",
  "rating",
  "userRatingCount",
  "websiteUri",
  "internationalPhoneNumber",
  "reviews",
].join(",");

/** Place Details: full signals for a single `placeId`. */
export async function getPlaceDetails(placeId: string): Promise<PlaceMatch> {
  return cacheOrCompute(
    cacheKey(["places", "details", placeId]),
    () => getPlaceDetailsLive(placeId),
    24 * 60 * 60, // 24h — place data changes rarely
  );
}

async function getPlaceDetailsLive(placeId: string): Promise<PlaceMatch> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: { ...headers(), "X-Goog-FieldMask": DETAIL_FIELDS },
  });

  if (!res.ok) {
    throw new Error(`Google Places place details failed (${res.status}): ${await res.text()}`);
  }

  const d = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
    websiteUri?: string;
  };

  return {
    placeId: d.id,
    name: d.displayName?.text ?? "Unknown property",
    address: d.formattedAddress ?? "",
    types: d.types ?? [],
    rating: d.rating ?? null,
    userRatingCount: d.userRatingCount ?? null,
    websiteUri: d.websiteUri ?? null,
  };
}
