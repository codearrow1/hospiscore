import { describe, it, expect, beforeAll } from "vitest";
import { searchProperties, resolvePropertyById } from "@/lib/resolver";
import { fetchReviewSignals } from "@/lib/providers/reviews";
import { properties } from "@/lib/data";

// The test environment has no Google Places key, so the resolver runs in demo
// mode. Set GOOGLE_PLACES_API_KEY in the CI environment to exercise live paths.
beforeAll(() => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.REVIEW_PROVIDER;
});

describe("searchProperties (demo mode)", () => {
  it("returns the full seeded dataset on an empty query", async () => {
    const results = await searchProperties("");
    expect(results.length).toBe(properties.length);
    expect(results.every((r) => r.isLive === false)).toBe(true);
  });

  it("filters by name, city and country", async () => {
    const byCity = await searchProperties("lisbon");
    expect(byCity.length).toBeGreaterThan(0);
    expect(byCity.every((r) => r.city.toLowerCase() === "lisbon")).toBe(true);
  });

  it("returns scored results with review totals", async () => {
    const results = await searchProperties("");
    for (const r of results) {
      expect(r.overall).toBeGreaterThanOrEqual(0);
      expect(r.overall).toBeLessThanOrEqual(100);
      expect(r.totalReviews).toBeGreaterThan(0);
      expect(r.platformsCount).toBeGreaterThan(0);
    }
  });
});

describe("resolvePropertyById (demo mode)", () => {
  it("resolves a demo slug", async () => {
    const prop = await resolvePropertyById("the-royal-sandpiper");
    expect(prop?.name).toBe("The Royal Sandpiper");
  });

  it("returns null for an unknown slug", async () => {
    expect(await resolvePropertyById("nope")).toBeNull();
  });

  it("returns null for a live id while in demo mode", async () => {
    expect(await resolvePropertyById("place:ChIJxxx")).toBeNull();
  });
});

describe("fetchReviewSignals (demo provider)", () => {
  it("matches a seeded property by normalized name and returns its OTAs", async () => {
    const res = await fetchReviewSignals({
      propertyName: "Gilded Fox Boutique Hotel",
    });
    expect(res.live).toBe(false);
    expect(res.sources.length).toBeGreaterThan(0);
    expect(res.platforms.booking?.present).toBe(true);
    // Google is intentionally not part of the review provider result.
    expect(res.platforms.google).toBeUndefined();
  });

  it("returns empty sources for an unknown property", async () => {
    const res = await fetchReviewSignals({ propertyName: "Nowhere Hotel" });
    expect(res.sources).toEqual([]);
    expect(res.platforms).toEqual({});
  });
});
