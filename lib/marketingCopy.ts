import { dataMode } from "@/lib/config";

/**
 * Honest, data-mode-aware copy for the public score funnel.
 *
 * The engine returns the live Google/review-provider path only when configured
 * (GOOGLE_PLACES_API_KEY set); otherwise it serves the seeded demo dataset. The
 * marketing copy must not claim live data it isn't serving, so these strings
 * are derived from the actual runtime mode rather than hardcoded.
 */

/** Claim that sits directly under the search widget. */
export function scoreCoverageNote(): string {
  return dataMode() === "live"
    ? "No sign-up needed. Scores cover Google, Booking.com, TripAdvisor, Expedia, Airbnb and more."
    : "No sign-up needed. Every signal is shown as verified or not yet verified — the score never invents data.";
}

/** Hero/TRUST label describing the data provenance of the score. */
export function scoreProvenanceLabel(): string {
  return dataMode() === "live"
    ? "Live worldwide data · Google Places"
    : "Verified platform signals · clear provenance";
}

/** Short summary of what powers the score, shown near the report features. */
export function scoreDataSummary(): string {
  return dataMode() === "live"
    ? "Powered by Google Places and review providers, enriched the minute you search."
    : "Every signal is labelled verified or not yet verified — we never invent data that isn't available.";
}
