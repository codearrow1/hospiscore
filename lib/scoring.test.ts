import { describe, it, expect } from "vitest";
import { computeScore, gradeForScore, WEIGHTS } from "../lib/scoring";
import type { RawSignals, Property } from "../lib/types";
import { properties } from "../lib/data";

function makeSignals(overrides: Partial<RawSignals> = {}): RawSignals {
  return {
    platforms: {
      google: {
        present: true,
        rating: 4.6,
        maxRating: 5,
        reviewCount: 500,
        reviewsRecent30: 25,
        responseRate: 0.9,
      },
      booking: {
        present: true,
        rating: 8.9,
        maxRating: 10,
        reviewCount: 600,
        reviewsRecent30: 40,
        responseRate: 0.8,
      },
      tripadvisor: {
        present: true,
        rating: 4.5,
        maxRating: 5,
        reviewCount: 300,
        reviewsRecent30: 15,
        responseRate: 0.7,
      },
      expedia: {
        present: false,
        rating: 0,
        maxRating: 5,
        reviewCount: 0,
        reviewsRecent30: 0,
        responseRate: 0,
      },
      airbnb: {
        present: false,
        rating: 0,
        maxRating: 5,
        reviewCount: 0,
        reviewsRecent30: 0,
        responseRate: 0,
      },
    },
    presence: {
      gbpCompleteness: 1,
      websiteQuality: 90,
      socialScore: 80,
      directoryListings: 5,
      localPackVisible: true,
    },
    ...overrides,
  };
}

describe("gradeForScore", () => {
  it("maps score bands to grades", () => {
    expect(gradeForScore(90)).toBe("Excellent");
    expect(gradeForScore(85)).toBe("Excellent");
    expect(gradeForScore(84)).toBe("Good");
    expect(gradeForScore(70)).toBe("Good");
    expect(gradeForScore(69)).toBe("Fair");
    expect(gradeForScore(50)).toBe("Fair");
    expect(gradeForScore(49)).toBe("Poor");
    expect(gradeForScore(0)).toBe("Poor");
  });
});

describe("computeScore", () => {
  it("returns a 0..100 overall score", () => {
    const r = computeScore(makeSignals());
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });

  it("weights sum to 100%", () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("scores a strong property higher than a weak one", () => {
    const strong = computeScore(makeSignals());
    const weak = computeScore(
      makeSignals({
        platforms: {
          google: {
            present: true,
            rating: 2.5,
            maxRating: 5,
            reviewCount: 12,
            reviewsRecent30: 1,
            responseRate: 0.05,
          },
          booking: { present: false, rating: 0, maxRating: 10, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          tripadvisor: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          expedia: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          airbnb: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
        },
        presence: {
          gbpCompleteness: 0.1,
          websiteQuality: 10,
          socialScore: 10,
          directoryListings: 0,
          localPackVisible: false,
        },
      }),
    );
    expect(strong.overall).toBeGreaterThan(weak.overall);
  });

  it("scores a property with no platforms as 0..low", () => {
    const r = computeScore(
      makeSignals({
        platforms: {
          google: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          booking: { present: false, rating: 0, maxRating: 10, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          tripadvisor: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          expedia: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          airbnb: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
        },
      }),
    );
    expect(r.overall).toBeLessThanOrEqual(50);
  });

  it("includes all 13 components with weight + detail", () => {
    const r = computeScore(makeSignals());
    expect(r.components).toHaveLength(13);
    for (const c of r.components) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
      expect(c.detail.length).toBeGreaterThan(0);
    }
    const keys = r.components.map((c) => c.key);
    expect(keys).toContain("guestExperience");
    expect(keys).toContain("amenities");
    expect(keys).toContain("visualContent");
    expect(keys).toContain("sustainability");
    expect(keys).toContain("accessibility");
    expect(keys).toContain("directBookings");
    expect(keys).toContain("brandTrust");
  });

  it("reports data completeness based on sourced components", () => {
    const complete = computeScore(
      makeSignals({
        quality: { service: 90, cleanliness: 88, valueForMoney: 80, location: 92, facilities: 84 },
        profile: {
          amenities: 90,
          visualContent: 85,
          sustainability: 60,
          accessibility: 55,
          directBookings: 40,
          starConsistency: 90,
          awards: 4,
        },
      }),
    );
    expect(complete.dataCompleteness).toBe(100);

    const partial = computeScore(makeSignals());
    expect(partial.dataCompleteness).toBeLessThan(100);
    // neutral 50 keeps an unscored guest-experience at the midpoint
    const guest = complete.components.find((c) => c.key === "guestExperience");
    const guestPartial = partial.components.find((c) => c.key === "guestExperience");
    expect(guestPartial!.score).toBe(50);
    expect(guest!.score).toBeGreaterThan(50);
  });

  it("aggregates review totals across active platforms", () => {
    const r = computeScore(makeSignals());
    expect(r.totalReviews).toBe(1400);
    expect(r.platformsCount).toBe(3);
  });

  it("normalizes different rating scales (5 vs 10) consistently", () => {
    const five = computeScore(
      makeSignals({
        platforms: {
          google: { present: true, rating: 4, maxRating: 5, reviewCount: 100, reviewsRecent30: 10, responseRate: 0.8 },
          booking: { present: false, rating: 0, maxRating: 10, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          tripadvisor: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          expedia: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          airbnb: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
        },
      }),
    );
    const ten = computeScore(
      makeSignals({
        platforms: {
          google: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          booking: { present: true, rating: 8, maxRating: 10, reviewCount: 100, reviewsRecent30: 10, responseRate: 0.8 },
          tripadvisor: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          expedia: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
          airbnb: { present: false, rating: 0, maxRating: 5, reviewCount: 0, reviewsRecent30: 0, responseRate: 0 },
        },
      }),
    );
    expect(five.components.find((c) => c.key === "ratingQuality")?.score).toBe(
      ten.components.find((c) => c.key === "ratingQuality")?.score,
    );
  });
});

describe("demo dataset", () => {
  it("produces scores for every seeded property", () => {
    for (const prop of properties) {
      const r = computeScore(prop.signals);
      expect(Number.isFinite(r.overall)).toBe(true);
      expect(r.totalReviews).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not mutate signals across repeated computation", () => {
    const prop: Property = properties[0];
    const snapshot = JSON.stringify(prop.signals);
    computeScore(prop.signals);
    computeScore(prop.signals);
    expect(JSON.stringify(prop.signals)).toBe(snapshot);
  });
});
