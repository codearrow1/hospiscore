/**
 * Regression (product-readiness): honest data-mode copy.
 *
 * The public score funnel must never claim live/Google data when the engine is
 * not configured to serve it. These helpers derive copy from the actual runtime
 * data mode, and this test pins that invariant so a future hardcoded "live"
 * overclaim can't quietly reappear.
 */
import { describe, expect, test, vi } from "vitest";

async function loadCopy(mode: "live" | "demo") {
  vi.resetModules();
  if (mode === "live") {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
  } else {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
  }
  const mod = await import("@/lib/marketingCopy");
  vi.unstubAllEnvs();
  return mod;
}

describe("score funnel honest-copy invariants (demo default)", () => {
  test("demo copy does not mention Google Places / live data", async () => {
    const { scoreProvenanceLabel, scoreDataSummary, scoreCoverageNote } = await loadCopy("demo");
    const all = [
      scoreProvenanceLabel(),
      scoreDataSummary(),
      scoreCoverageNote(),
    ].join(" ");
    expect(all).not.toMatch(/Google Places/i);
    expect(all).not.toMatch(/live/i);
    expect(all).toMatch(/verified/i);
  });

  test("demo copy surfaces data provenance honestly", async () => {
    const { scoreCoverageNote } = await loadCopy("demo");
    expect(scoreCoverageNote()).toMatch(/never invents data/i);
    expect(scoreCoverageNote()).toContain("No sign-up needed");
  });

  test("live copy advertises Google Places when configured", async () => {
    const { scoreProvenanceLabel, scoreCoverageNote } = await loadCopy("live");
    expect(scoreProvenanceLabel()).toMatch(/Google Places/i);
    expect(scoreCoverageNote()).toContain("Booking.com");
  });
});
