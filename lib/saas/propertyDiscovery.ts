/**
 * Admin Google Places discovery + property matching (Phase E).
 *
 * Lets an admin search Google for a property listing and see, per result,
 * whether it is ALREADY represented in HospiOS — linking to the same Place ID
 * (`placeId @unique`) or matching an existing property by normalized name /
 * address (a likely duplicate that must be deduped, not re-imported).
 *
 * Google is NOT the system of record. A matched result is surfaced so the
 * admin can navigate to the canonical internal Property/Organization rather
 * than duplicating it. New imports carry `placeId` as the external identity;
 * the internal ACME id stays canonical.
 *
 * The search provider is injectable so the matching logic is unit-testable
 * without hitting the live Google API.
 */
import { prisma } from "@/lib/prisma";
import { searchPlaces as liveSearchPlaces, type PlaceMatch } from "@/lib/providers/google";

export type MatchStatus = "none" | "linked" | "duplicate";

export interface DiscoveredMatch {
  placeId: string;
  name: string;
  address: string;
  types: string[];
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  /** How this result relates to an existing HospiOS property. */
  match: {
    status: MatchStatus;
    reason?: string;
    propertyId?: string;
    propertyName?: string;
    organizationId?: string;
    organizationName?: string;
  };
}

export interface DiscoverResult {
  ok: boolean;
  query: string;
  matches: DiscoveredMatch[];
  /** true when searchPlaces threw and we fell back to an empty/informational result. */
  fallback?: boolean;
  error?: string;
}

/**
 * Normalize a property name for comparison: lowercase, strip all non-letter
 * and non-digit characters, collapse whitespace. Used to detect duplicate
 * listings regardless of punctuation/case differences ("Hotel A - da Luz"
 * vs "Hotel A da Luz").
 */
export function normalizeName(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Contained-match heuristic: true when every word of the (probably shorter)
 * normalized `needle` appears in `haystack`. Guards against trivial collisions
 * while tolerating extra words like "by", "-", "hotel", "resort".
 */
export function nameContained(needle: string, haystack: string): boolean {
  const n = normalizeName(needle);
  if (!n) return false;
  const words = n.split(" ");
  const h = normalizeName(haystack).split(" ");
  return words.every((w) => h.includes(w));
}

function cityFromAddress(address: string): string {
  const parts = (address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2];
}

export interface ExistingProperty {
  id: string;
  name: string;
  placeId: string | null;
  city: string | null;
  orgId: string | null;
  orgName: string | null;
}

export async function loadExistingProperties(): Promise<ExistingProperty[]> {
  const rows = await prisma.property.findMany({
    select: {
      id: true,
      name: true,
      placeId: true,
      city: true,
      organization: { select: { id: true, legalName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    placeId: r.placeId,
    city: r.city,
    orgId: r.organization?.id ?? null,
    orgName: r.organization?.legalName ?? null,
  }));
}

/**
 * Score a Google match against every existing property and return the single
 * best relationship. Priority: exact placeId link > normalized-name+city
 * duplicate > none.
 */
export function matchAgainstExisting(place: PlaceMatch, existing: ExistingProperty[]): DiscoveredMatch["match"] {
  for (const e of existing) {
    if (e.placeId && e.placeId === place.placeId) {
      return {
        status: "linked",
        reason: "Already linked to this Google listing in HospiOS.",
        propertyId: e.id,
        propertyName: e.name,
        organizationId: e.orgId ?? undefined,
        organizationName: e.orgName ?? undefined,
      };
    }
  }

  const googleCity = cityFromAddress(place.address);
  let best: DiscoveredMatch["match"] | null = null;
  for (const e of existing) {
    const sameCity = !googleCity || !e.city || googleCity.toLowerCase() === e.city.toLowerCase();
    const sameName =
      nameContained(place.name, e.name) || nameContained(e.name, place.name);
    // Avoid matching a bare generic name like just "Hotel" or "Resort" —
    // but a multi-word name that STARTS with a generic word ("Hotel Azul")
    // is fine to match.
    const generic = new Set(["hotel", "resort", "inn", "property", "hostel", "suites"]);
    const fullName = normalizeName(place.name);
    if (!sameName || generic.has(fullName)) continue;
    if (!sameCity) continue;
    best = {
      status: "duplicate",
      reason: "Possible duplicate of an existing HospiOS property (name + city match).",
      propertyId: e.id,
      propertyName: e.name,
      organizationId: e.orgId ?? undefined,
      organizationName: e.orgName ?? undefined,
    };
    break;
  }
  return best ?? { status: "none" };
}

export type SearchPlacesFn = (query: string, limit?: number) => Promise<PlaceMatch[]>;
let searchPlacesOverride: SearchPlacesFn | null = null;

/** Test seam: pass a fake search fn, or null to restore the live provider. */
export function __setSearchPlaces(fn: SearchPlacesFn | null): void {
  searchPlacesOverride = fn;
}

function doSearch(query: string, limit: number): Promise<PlaceMatch[]> {
  return searchPlacesOverride ? searchPlacesOverride(query, limit) : liveSearchPlaces(query, limit);
}

/**
 * Admin discovery: search Google and annotate each result with its relationship
 * to existing HospiOS properties. Never throws on Google failure — returns a
 * `fallback` result so the admin sees a clear message instead of a crash.
 */
export async function discoverProperties(query: string, limit = 8): Promise<DiscoverResult> {
  const q = (query ?? "").trim();
  if (!q) return { ok: true, query: q, matches: [] };

  let places: PlaceMatch[];
  try {
    places = await doSearch(q, limit);
  } catch (err) {
    return {
      ok: false,
      query: q,
      matches: [],
      fallback: true,
      error: err instanceof Error ? err.message : "Google Places search failed",
    };
  }

  const existing = await loadExistingProperties();
  const matches: DiscoveredMatch[] = places.map((p) => ({
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    types: p.types,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    websiteUri: p.websiteUri,
    match: matchAgainstExisting(p, existing),
  }));

  return { ok: true, query: q, matches };
}
