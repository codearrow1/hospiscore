import { describe, it, expect } from "vitest";
import { buildAlertDigest } from "./alerts";
import { computeScore } from "./scoring";
import type { RawSignals } from "./types";
import type { SavedProperty } from "./saved";

const SIGNALS: RawSignals = {
  platforms: {
    google: { present: true, rating: 4.5, maxRating: 5, reviewCount: 100, reviewsRecent30: 5, responseRate: 0.8 },
  },
  presence: {
    gbpCompleteness: 0.8,
    websiteQuality: 70,
    socialScore: 60,
    directoryListings: 2,
    localPackVisible: true,
  },
};

function savedWith(history: number[]): SavedProperty {
  return {
    slug: "s",
    name: "Property X",
    city: "City",
    country: "Country",
    color: "emerald",
    savedAt: "2026-01-01T00:00:00.000Z",
    signals: SIGNALS,
    history: history.map((o, i) => ({
      at: `2026-01-0${i + 1}T00:00:00.000Z`,
      overall: o,
      grade: o >= 85 ? "Excellent" : o >= 70 ? "Good" : o >= 50 ? "Fair" : "Poor",
    })),
  };
}

describe("buildAlertDigest", () => {
  it("reports no change when the recomputed score equals the last point", () => {
    const current = computeScore(SIGNALS).overall;
    const digest = buildAlertDigest([savedWith([current])]);
    expect(digest.changedCount).toBe(0);
    expect(digest.subject).toContain("no changes");
    expect(digest.items[0].delta).toBe(0);
  });

  it("flags properties whose score changed since the last point", () => {
    const current = computeScore(SIGNALS).overall;
    const digest = buildAlertDigest([savedWith([current - 12])]);
    expect(digest.changedCount).toBe(1);
    expect(digest.subject).toContain("1 saved propert");
    expect(digest.items[0].delta).toBeGreaterThan(0);
    expect(digest.html).toContain("Property X");
  });
});