/**
 * Admin property import from Google Places (Phase E).
 *
 * Given a Google `placeId`, fetch the field-masked Place Details and create
 * (or reuse) the canonical internal Property + Organization. The internal
 * Property id is the system of record; `placeId` is recorded as the Google
 * external identity on `Property.placeId @unique`.
 *
 * Dedupe-safe & idempotent:
 *  - If a Property already holds this `placeId`, return it untouched (reuse).
 *  - If a Property already matches by normalized name + city (a duplicate the
 *    discovery step should have flagged), refuse unless `force` is set.
 *  - Concurrency: the `placeId @unique` constraint makes a parallel double
 *    import safe — one wins, the other reuses.
 *
 * The Place Details provider is injectable so the logic is unit-testable
 * without the live Google API.
 */
import { prisma } from "@/lib/prisma";
import { getPlaceDetails as liveGetPlaceDetails, type PlaceMatch } from "@/lib/providers/google";
import { createOrganization } from "@/lib/saas/organizations";
import { writeSaasAudit } from "@/lib/saas/audit";
import { matchAgainstExisting, loadExistingProperties, normalizeName, nameContained } from "@/lib/saas/propertyDiscovery";

export interface NewOrgInput {
  legalName: string;
  businessName?: string;
  country?: string;
  website?: string;
}

export interface ImportAttribution {
  acquisitionSource?: string;
  acquisitionCampaign?: string;
  affiliateId?: string;
  partnerId?: string;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  status?: "created" | "reused";
  property?: { id: string; name: string; placeId: string; organizationId: string };
  organizationId?: string;
}

/**
 * Resolve city/country from a Google formatted address (comma segments).
 * The last segment is treated as the country, the second-to-last as the city.
 */
export function splitAddress(address: string): { city: string | null; country: string | null } {
  const parts = (address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { city: null, country: null };
  const country = parts[parts.length - 1];
  const city = parts.length > 1 ? parts[parts.length - 2] : null;
  return {
    city: city && city.length <= 120 ? city : null,
    country: /^[A-Za-z]{2}$/.test(country) ? country : country.length <= 60 ? country : null,
  };
}

/** Decide the target organization: provided id, provided new-org, or error. */
async function resolveOrganization(opts: {
  organizationId?: string;
  newOrg?: NewOrgInput;
}): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  if (opts.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: opts.organizationId }, select: { id: true } });
    if (!org) return { ok: false, error: "Organization not found" };
    return { ok: true, organizationId: opts.organizationId };
  }
  if (opts.newOrg?.legalName) {
    const org = await createOrganization({
      legalName: opts.newOrg.legalName,
      businessName: opts.newOrg.businessName,
      country: opts.newOrg.country,
      website: opts.newOrg.website,
    });
    return { ok: true, organizationId: org.id };
  }
  return { ok: false, error: "organizationId or newOrg is required" };
}

export type GetPlaceDetailsFn = (placeId: string) => Promise<PlaceMatch>;
let getPlaceDetailsOverride: GetPlaceDetailsFn | null = null;

/** Test seam: pass a fake details fn, or null to restore the live provider. */
export function __setGetPlaceDetails(fn: GetPlaceDetailsFn | null): void {
  getPlaceDetailsOverride = fn;
}

function doGetPlaceDetails(placeId: string): Promise<PlaceMatch> {
  return getPlaceDetailsOverride ? getPlaceDetailsOverride(placeId) : liveGetPlaceDetails(placeId);
}

export async function importProperty(params: {
  placeId: string;
  organizationId?: string;
  newOrg?: NewOrgInput;
  attribution?: ImportAttribution;
  force?: boolean;
  byEmail: string;
  ip?: string;
}): Promise<ImportResult> {
  const pid = (params.placeId ?? "").trim();
  if (!pid) return { ok: false, error: "placeId is required" };

  let place: PlaceMatch;
  try {
    place = await doGetPlaceDetails(pid);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not resolve the listing from Google; try again",
    };
  }
  if (place.placeId !== pid) return { ok: false, error: "Google returned a different place than requested" };

  // 1) Exact external-identity reuse — idempotent.
  const existingByPlace = await prisma.property.findUnique({
    where: { placeId: pid },
    select: { id: true, name: true, organizationId: true },
  });
  if (existingByPlace) {
    return {
      ok: true,
      status: "reused",
      property: { id: existingByPlace.id, name: existingByPlace.name, placeId: pid, organizationId: existingByPlace.organizationId },
      organizationId: existingByPlace.organizationId,
    };
  }

  const { city, country } = splitAddress(place.address);

  // 2) Duplicate guard: refuse a likely duplicate on name + city unless forced.
  if (!params.force) {
    const existing = await loadExistingProperties();
    const m = matchAgainstExisting(
      { placeId: place.placeId, name: place.name, address: place.address, types: place.types, rating: place.rating, userRatingCount: place.userRatingCount, websiteUri: place.websiteUri, phone: place.phone },
      existing,
    );
    if (m.status === "duplicate") {
      return {
        ok: false,
        error: `This looks like a duplicate of "${m.propertyName}"${m.organizationName ? ` (${m.organizationName})` : ""}. Review the discovery step or set force to import anyway.`,
      };
    }
  }

  // 3) Resolve organization (existing or create).
  const orgRes = await resolveOrganization({ organizationId: params.organizationId, newOrg: params.newOrg });
  if (!orgRes.ok) return orgRes;

  // 4) Create the canonical Property carrying the Google placeId.
  let property: { id: string; name: string; placeId: string | null; organizationId: string };
  try {
    property = await prisma.property.create({
      data: {
        organizationId: orgRes.organizationId,
        name: place.name,
        city,
        country,
        placeId: pid,
        pmsInstanceUrl: place.websiteUri ? `${place.websiteUri}` : null,
      },
      select: { id: true, name: true, placeId: true, organizationId: true },
    });
  } catch (e) {
    // Concurrency: the unique placeId constraint trips if another import won.
    if (e instanceof Error && /unique/i.test(e.message)) {
      const winner = await prisma.property.findUnique({
        where: { placeId: pid },
        select: { id: true, name: true, organizationId: true },
      });
      if (winner) {
        return {
          ok: true,
          status: "reused",
          property: { id: winner.id, name: winner.name, placeId: pid as string, organizationId: winner.organizationId },
          organizationId: winner.organizationId,
        };
      }
    }
    throw e;
  }

  await writeSaasAudit({
    byEmail: params.byEmail,
    action: "property.imported",
    entity: "property",
    entityId: property.id,
    detail: `${place.name} (${pid})`,
    ip: params.ip,
    after: { placeId: pid, organizationId: property.organizationId },
  });

  return {
    ok: true,
    status: "created",
    property: {
      id: property.id,
      name: property.name,
      placeId: pid as string,
      organizationId: property.organizationId,
    },
    organizationId: property.organizationId,
  };
}

export { normalizeName, nameContained };
