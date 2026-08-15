import { describe, it, expect } from "vitest";
import { datasetBenchmark } from "../lib/benchmark";
import { WEIGHTS } from "../lib/scoring";
import { properties } from "../lib/data";

describe("datasetBenchmark", () => {
  it("returns an in-range overall average and best", () => {
    const b = datasetBenchmark();
    expect(b.overallAverage).toBeGreaterThanOrEqual(0);
    expect(b.overallAverage).toBeLessThanOrEqual(100);
    expect(b.overallBest).toBeGreaterThanOrEqual(b.overallAverage);
  });

  it("covers every weighted criterion across the dataset", () => {
    const b = datasetBenchmark();
    for (const key of Object.keys(WEIGHTS)) {
      expect(b.byKey[key]).toBeDefined();
    }
    expect(b.byKey.ratingQuality.count).toBe(properties.length);
  });
});