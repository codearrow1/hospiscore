import { properties } from "./data";
import { computeScore } from "./scoring";

export interface BenchmarkLine {
  overallAverage: number;
  overallBest: number;
  propertyCount: number;
  byKey: Record<string, { average: number; best: number; count: number }>;
}

export function datasetBenchmark(): BenchmarkLine {
  const scores = properties.map((p) => computeScore(p.signals));
  const overallAverage = Math.round(
    scores.reduce((s, r) => s + r.overall, 0) / scores.length,
  );
  const overallBest = Math.max(...scores.map((s) => s.overall));
  const propertyCount = scores.length;

  const byKey: BenchmarkLine["byKey"] = {};
  for (const r of scores) {
    for (const c of r.components) {
      const entry = (byKey[c.key] ??= { average: 0, best: 0, count: 0 });
      entry.average += c.score;
      entry.best = Math.max(entry.best, c.score);
      entry.count += 1;
    }
  }
  for (const k of Object.keys(byKey)) {
    byKey[k].average = Math.round(byKey[k].average / byKey[k].count);
  }
  return { overallAverage, overallBest, propertyCount, byKey };
}

/** Overall scores of every dataset property, used to rank a single property. */
export function datasetOverall(): number[] {
  return properties.map((p) => computeScore(p.signals).overall);
}