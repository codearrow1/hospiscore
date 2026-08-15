import type { ReviewRecord } from "./nlp";
import { demoReview } from "./nlp";

/**
 * A small seeded set of realistic guest reviews per demo property.
 * In production this is replaced by the review provider (StayAPI/Apify),
 * which returns live text — the analyzer treats them identically.
 */
export const demoReviewsBySlug: Record<string, ReviewRecord[]> = {
  "the-royal-sandpiper": [
    demoReview("booking", 5, "Immaculate rooms and genuinely friendly staff. Breakfast was delicious.", 1),
    demoReview("google", 4, "Great central location close to the waterfront. Slightly slow wifi.", 2),
    demoReview("tripadvisor", 5, "Beautiful pool and very clean room, lovely stay.", 3),
    demoReview("booking", 3, "Wi-fi kept dropping and it was noisy at night from the bar.", 4),
    demoReview("expedia", 5, "Great price for the location, staff welcomed us warmly.", 5),
  ],
  "gilded-fox-boutique": [
    demoReview("google", 5, "Perfect central location, gorgeous photos match the room.", 1),
    demoReview("booking", 4, "Beautiful photos and amenities, but you can hear the corridor.", 2),
    demoReview("tripadvisor", 5, "Friendly staff and excellent value for such a central spot.", 3),
  ],
  "marigold-hotel": [
    demoReview("google", 2, "Rude staff and the room was dirty. Not worth the money.", 1),
    demoReview("booking", 3, "Breakfast was bland and the amenities were out of order.", 2),
  ],
};

export function reviewsFor(slug: string): ReviewRecord[] {
  return demoReviewsBySlug[slug] ?? [];
}