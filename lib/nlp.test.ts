import { describe, it, expect } from "vitest";
import {
  classifyReview,
  analyzeGuestReviews,
  qualitySignalsFromGuest,
  demoReview,
} from "../lib/nlp";

function r(rating: number, text: string, i: number) {
  return demoReview("booking", rating, text, i);
}

describe("classifyReview", () => {
  it("tags positive aspects from free-text", () => {
    const hits = classifyReview(r(5, "Lovely friendly staff, spotless room, great breakfast", 1));
    const aspects = hits.map((h) => h.aspect);
    expect(aspects).toContain("service");
    expect(aspects).toContain("cleanliness");
    expect(aspects).toContain("breakfast");
  });

  it("detects negative sentiment for complaints", () => {
    const hits = classifyReview(r(1, "Rude staff and the room was filthy. Not worth the money.", 1));
    expect(hits.filter((h) => h.aspect === "service")[0]?.tone).toBe("negative");
    expect(hits.filter((h) => h.aspect === "cleanliness")[0]?.tone).toBe("negative");
  });
});

describe("analyzeGuestReviews", () => {
  it("is neutral for empty input", () => {
    const g = analyzeGuestReviews([]);
    expect(g.totalReviews).toBe(0);
    expect(g.positiveRatio).toBe(0);
    expect(g.perAspect).toEqual({});
  });

  it("splits reviews into positive and negative counts", () => {
    const g = analyzeGuestReviews([r(5, "Perfect stay", 1), r(2, "Bad experience", 2)]);
    expect(g.positiveCount).toBe(1);
    expect(g.negativeCount).toBe(1);
    expect(g.positiveRatio).toBeCloseTo(0.5);
  });
});

describe("qualitySignalsFromGuest", () => {
  it("returns undefined when no core aspect mentioned", () => {
    const g = analyzeGuestReviews([r(5, "Great views and wonderful sea air.", 1)]);
    expect(qualitySignalsFromGuest(g)).toBeUndefined();
  });

  it("fills quality when core aspects are mentioned", () => {
    const g = analyzeGuestReviews([
      r(5, "Friendly staff and spotless, clean rooms.", 1),
      r(1, "Dirty sheets and rude front desk.", 2),
    ]);
    const q = qualitySignalsFromGuest(g);
    expect(q).toBeDefined();
    expect(q?.service).toBeGreaterThan(0);
    expect(q?.cleanliness).toBeGreaterThan(0);
  });
});