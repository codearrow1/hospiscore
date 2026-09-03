import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  normalizeName,
  nameContained,
  matchAgainstExisting,
  discoverProperties,
  __setSearchPlaces,
  type ExistingProperty,
  type SearchPlacesFn,
} from "@/lib/saas/propertyDiscovery";
import {
  importProperty,
  splitAddress,
  __setGetPlaceDetails,
  type GetPlaceDetailsFn,
} from "@/lib/saas/propertyImport";
import type { PlaceMatch } from "@/lib/providers/google";

let seq = 0;
const createdOrgs: string[] = [];
const createdProps: string[] = [];

async function cleanup() {
  for (const id of createdProps) await prisma.property.delete({ where: { id } }).catch(() => {});
  for (const id of createdOrgs) await prisma.organization.delete({ where: { id } }).catch(() => {});
  createdProps.length = 0;
  createdOrgs.length = 0;
}

beforeEach(async () => {
  await cleanup();
  __setSearchPlaces(null);
  __setGetPlaceDetails(null);
});

afterAll(async () => {
  await cleanup();
  __setSearchPlaces(null);
  __setGetPlaceDetails(null);
});

async function makeOrg(name?: string) {
  const org = await prisma.organization.create({ data: { legalName: name ?? `Import Org ${++seq}` } });
  createdOrgs.push(org.id);
  return org;
}

async function makeProperty(orgId: string, data: { name: string; placeId?: string | null; city?: string | null }) {
  const p = await prisma.property.create({
    data: { organizationId: orgId, name: data.name, placeId: data.placeId ?? null, city: data.city ?? null },
  });
  createdProps.push(p.id);
  return p;
}

function place(p: Partial<PlaceMatch>): PlaceMatch {
  return {
    placeId: p.placeId ?? "ChIJ-test",
    name: p.name ?? "Hotel Azul",
    address: p.address ?? "Rua A, Lisbon, Portugal",
    types: p.types ?? ["lodging"],
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    websiteUri: p.websiteUri ?? null,
    phone: p.phone ?? null,
  };
}

describe("propertyDiscovery pure helpers", () => {
  it("normalizes name: case, punctuation, diacritics", () => {
    expect(normalizeName("Memmo Alfama - Hotel")).toBe("memmo alfama hotel");
    expect(normalizeName("Hotel A'B")).toBe("hotel a b");
    expect(normalizeName("Café da Luz")).toBe("cafe da luz");
  });

  it("nameContained is case/order-of-query-word tolerant", () => {
    expect(nameContained("Hotel Azul", "Pousada Hotel Azul")).toBe(true);
    expect(nameContained("Hotel Azul", "Hotel Bela Vista")).toBe(false);
    expect(nameContained("", "anything")).toBe(false);
  });

  it("matchAgainstExisting links by exact placeId", () => {
    const existing: ExistingProperty[] = [
      { id: "prop1", name: "Hotel Azul", placeId: "ChIJ-azul", city: "Lisbon", orgId: "org1", orgName: "ACME" },
    ];
    expect(matchAgainstExisting(place({ placeId: "ChIJ-azul", name: "Hotel Azul" }), existing).status).toBe("linked");
  });

  it("matchAgainstExisting flags a duplicate by name+city", () => {
    const existing: ExistingProperty[] = [
      { id: "prop1", name: "Hotel Azul", placeId: null, city: "Lisbon", orgId: "org1", orgName: "ACME" },
    ];
    const m = matchAgainstExisting(place({ name: "Hotel Azul - Da Luz", address: "Rua X, Lisbon, Portugal" }), existing);
    expect(m.status).toBe("duplicate");
    expect(m.propertyId).toBe("prop1");
  });

  it("matchAgainstExisting returns none when name or city differ, or name is generic", () => {
    const existing: ExistingProperty[] = [
      { id: "prop1", name: "Hotel Azul", placeId: null, city: "Lisbon", orgId: "org1", orgName: "ACME" },
    ];
    expect(matchAgainstExisting(place({ name: "Hotel Azul", address: "X, Porto, Portugal" }), existing).status).toBe("none");
    expect(matchAgainstExisting(place({ name: "Hotel", address: "X, Lisbon, Portugal" }), existing).status).toBe("none");
    expect(matchAgainstExisting(place({ name: "Completely Different" }), existing).status).toBe("none");
  });
});

describe("discoverProperties", () => {
  it("returns annotated matches (duplicate against existing property)", async () => {
    const org = await makeOrg("Discovery Co");
    await makeProperty(org.id, { name: "Vila Galé Ópera", placeId: null, city: "Lisbon" });

    const fakeSearch: SearchPlacesFn = async () => [
      place({ placeId: "ChIJ-new", name: "Vila Galé Ópera - Hotel", address: "Tv. do Conde da Ponte, Lisbon, Portugal" }),
    ];
    __setSearchPlaces(fakeSearch);

    const res = await discoverProperties("vilagale opera");
    expect(res.ok).toBe(true);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].match.status).toBe("duplicate");
    expect(res.matches[0].placeId).toBe("ChIJ-new");
  });

  it("falls back cleanly when Google search throws", async () => {
    __setSearchPlaces(async () => {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    });
    const res = await discoverProperties("any");
    expect(res.ok).toBe(false);
    expect(res.fallback).toBe(true);
    expect(res.error).toContain("GOOGLE_PLACES_API_KEY");
    expect(res.matches).toEqual([]);
  });

  it("returns empty for a blank query without calling Google", async () => {
    let called = false;
    __setSearchPlaces((async () => {
      called = true;
      return [];
    }) as SearchPlacesFn);
    const res = await discoverProperties("   ");
    expect(res.matches).toEqual([]);
    expect(called).toBe(false);
  });
});

describe("splitAddress", () => {
  it("parses city and ISO2 country from a comma address", () => {
    expect(splitAddress("Rua Augusta, Lisbon, PT")).toEqual({ city: "Lisbon", country: "PT" });
  });
  it("handles missing parts", () => {
    expect(splitAddress("")).toEqual({ city: null, country: null });
    expect(splitAddress("Lisbon,Portugal")).toEqual({ city: "Lisbon", country: "Portugal" });
  });
});

describe("importProperty", () => {
  it("creates a new property and organization from place details", async () => {
    __setGetPlaceDetails((async () =>
      place({ placeId: "ChIJ-new", name: "New Hotel", address: "Rua 1, Lisbon, PT", websiteUri: "https://new.example" })
    ) as GetPlaceDetailsFn);

    const res = await importProperty({
      placeId: "ChIJ-new",
      newOrg: { legalName: "New HoldCo" },
      byEmail: "admin@test",
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("created");
    expect(res.property?.placeId).toBe("ChIJ-new");

    const prop = await prisma.property.findUnique({ where: { id: res.property!.id } });
    expect(prop?.city).toBe("Lisbon");
    expect(prop?.country).toBe("PT");
    createdProps.push(res.property!.id);
    createdOrgs.push(res.property!.organizationId);

    const audit = await prisma.auditLog.findFirst({ where: { targetId: res.property!.id, action: "property.imported" } });
    expect(audit).toBeTruthy();
  });

  it("reuses an existing property by placeId (idempotent)", async () => {
    const org = await makeOrg();
    await makeProperty(org.id, { name: "Existing", placeId: "ChIJ-dup", city: "Lisbon" });

    __setGetPlaceDetails((async () => place({ placeId: "ChIJ-dup", name: "Existing", address: "Rua, Lisbon, PT" })) as GetPlaceDetailsFn);

    const res = await importProperty({ placeId: "ChIJ-dup", organizationId: org.id, byEmail: "admin@test" });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("reused");
  });

  it("refuses a duplicate by name+city unless forced", async () => {
    const org = await makeOrg();
    await makeProperty(org.id, { name: "Hotel Azul", placeId: null, city: "Lisbon" });

    __setGetPlaceDetails((async () => place({ placeId: "ChIJ-azul2", name: "Hotel Azul - Suites", address: "Rua, Lisbon, PT" })) as GetPlaceDetailsFn);

    const refused = await importProperty({ placeId: "ChIJ-azul2", organizationId: org.id, byEmail: "admin@test" });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("duplicate");

    const forced = await importProperty({ placeId: "ChIJ-azul2", organizationId: org.id, byEmail: "admin@test", force: true });
    expect(forced.ok).toBe(true);
    expect(forced.status).toBe("created");
    createdProps.push(forced.property!.id);
  });

  it("rejects when Google details return a different placeId", async () => {
    __setGetPlaceDetails((async () => place({ placeId: "ChIJ-other", name: "Nope" })) as GetPlaceDetailsFn);
    const res = await importProperty({ placeId: "ChIJ-requested", organizationId: (await makeOrg()).id, byEmail: "admin@test" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("different place");
  });

  it("treats a concurrent double-import as a safe reuse (unique placeId)", async () => {
    const org = await makeOrg();
    __setGetPlaceDetails((async () => place({ placeId: "ChIJ-race", name: "Race Hotel", address: "Rua, Lisbon, PT" })) as GetPlaceDetailsFn);

    const [a, b] = await Promise.all([
      importProperty({ placeId: "ChIJ-race", organizationId: org.id, byEmail: "a@test" }),
      importProperty({ placeId: "ChIJ-race", organizationId: org.id, byEmail: "b@test" }),
    ]);
    expect(a.ok || b.ok).toBe(true);
    const props = await prisma.property.findMany({ where: { placeId: "ChIJ-race" } });
    expect(props).toHaveLength(1);
    props.forEach((p) => createdProps.push(p.id));
  });

  it("returns a validation error when neither org input is given", async () => {
    __setGetPlaceDetails((async () => place({ placeId: "ChIJ-noorg", name: "No Org", address: "Rua, Lisbon, PT" })) as GetPlaceDetailsFn);
    const res = await importProperty({ placeId: "ChIJ-noorg", byEmail: "admin@test" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/organization/i);
  });
});

describe("matchAgainstExisting types", () => {
  it("is purely typed and compiles against ExistingProperty", () => {
    const existing: ExistingProperty[] = [];
    expect(matchAgainstExisting(place({}), existing).status).toBe("none");
  });
});
