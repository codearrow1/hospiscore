import { describe, it, expect } from "vitest";
import { buildReport } from "../lib/report";
import { properties } from "../lib/data";

describe("buildReport", () => {
  it("produces strengths, watchouts and a headline for every property", () => {
    for (const p of properties) {
      const r = buildReport(p.name, p.signals);
      expect(r.headline).toContain(p.name);
      expect(r.strengths.length + r.watchouts.length + r.risks.length).toBeGreaterThan(0);
      expect(r.totalReviews).toBeGreaterThan(0);
      for (const item of [...r.strengths, ...r.watchouts, ...r.risks]) {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.body.length).toBeGreaterThan(0);
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("splits service dimensions into positives and negatives by quality", () => {
    const sandpiper = properties.find((p) => p.slug === "the-royal-sandpiper")!;
    const r = buildReport(sandpiper.name, sandpiper.signals);
    expect(r.servicesPositive.length).toBeGreaterThan(0);
  });

  it("sorts strengths strongest-first and risks weakest-first", () => {
    const p = properties[0];
    const r = buildReport(p.name, p.signals);
    const strengths = r.strengths.map((s) => s.score);
    const risks = r.risks.map((x) => x.score);
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
    expect(risks).toEqual([...risks].sort((a, b) => a - b));
  });

  it("reports market position deltas and rank against peers", () => {
    for (const p of properties) {
      const r = buildReport(p.name, p.signals);
      expect(r.market.peerCount).toBe(properties.length);
      expect(r.market.overallDelta).toBeGreaterThanOrEqual(-100);
      expect(r.market.overallDelta).toBeLessThanOrEqual(100);
      expect(r.market.aboveAverage + r.market.belowAverage).toBe(
        r.strengths.length + r.watchouts.length + r.risks.length,
      );
      expect(r.market.rankPosition).toBeGreaterThanOrEqual(0);
      expect(r.market.rankPosition).toBeLessThan(r.market.peerCount);
    }
  });
});