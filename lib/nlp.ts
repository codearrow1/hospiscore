import type { PlatformKey, QualitySignals } from "./types";

/**
 * Lightweight, dependency-free review analysis.
 *
 * Reviews arrive as raw text + rating from the provider layer. The analyzer
 * maps each review to the guest-experience aspects we score, so `quality`
 * can be derived from real guest language instead of a neutral default.
 * Swap/augment with an LLM or a vendor API later — this is the type contract
 * and a deterministic fallback.
 */

export const ASPECTS = [
  "service",
  "cleanliness",
  "valueForMoney",
  "location",
  "facilities",
  "wifi",
  "breakfast",
  "noise",
] as const;

export type Aspect = (typeof ASPECTS)[number];

/** Core aspects that map onto the scored `QualitySignals` dimensions. */
const CORE_ASPECTS: (keyof QualitySignals)[] = ["service", "cleanliness", "valueForMoney", "location", "facilities"];

export const ASPECT_LABEL: Record<Aspect, string> = {
  service: "Staff & service",
  cleanliness: "Cleanliness",
  valueForMoney: "Value for money",
  location: "Location",
  facilities: "Facilities",
  wifi: "Wi-fi & connectivity",
  breakfast: "Breakfast",
  noise: "Quietness",
};

export interface ReviewRecord {
  id: string;
  platform: PlatformKey;
  rating: number; // 1..5, normalized
  date: string; // ISO
  text: string;
  author?: string;
}

export interface GuestIntelligence {
  /** Aspect -> 0..100 score, only for aspects mentioned by reviews. */
  perAspect: Partial<Record<Aspect, number>>;
  positiveCount: number;
  negativeCount: number;
  totalReviews: number;
  positiveRatio: number; // 0..1
}

const KEYWORDS: Record<Aspect, { pos: string[]; neg: string[] }> = {
  service: { pos: ["staff", "friendly", "helpful", "service", "welcoming"], neg: ["rude", "unhelpful", "ignored", "slow service"] },
  cleanliness: { pos: ["clean", "spotless", "tidy", "fresh"], neg: ["dirty", "filthy", "grubby", "stained", "dusty", "mold", "unclean"] },
  valueForMoney: { pos: ["value", "worth", "affordable", "great price"], neg: ["expensive", "overpriced", "not worth", "rip"] },
  location: { pos: ["location", "located", "central", "close to", "convenient"], neg: ["far", "remote", "nowhere", "inconvenient"] },
  facilities: { pos: ["pool", "gym", "spa", "amenities", "facilities"], neg: ["broken", "unavailable", "closed", "out of order"] },
  wifi: { pos: ["wifi", "internet", "fast wifi"], neg: ["no wifi", "slow wifi", "wifi kept", "no signal"] },
  breakfast: { pos: ["breakfast", "delicious", "included", "tasty"], neg: ["breakfast", "bland", "downfold", "not included"] },
  noise: { pos: ["quiet", "peaceful", "no noise"], neg: ["noisy", "loud", "slammed", "thin walls", "traffic"] },
};

function mentions(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => w.split(" ").every((part) => t.includes(part)));
}

/** Classify a single review against every aspect it mentions. */
export function classifyReview(review: ReviewRecord): { aspect: Aspect; score: number; tone: "positive" | "negative" }[] {
  const text = review.text.toLowerCase();
  const ratingScore = ((review.rating - 1) / 4) * 100; // 5 -> 100, 1 -> 0
  const out: { aspect: Aspect; score: number; tone: "positive" | "negative" }[] = [];

  for (const aspect of ASPECTS) {
    const kw = KEYWORDS[aspect];
    const positive = mentions(text, kw.pos);
    const negative = mentions(text, kw.neg);
    // For aspects where the keywords overlap (e.g. "wifi/breakfast" neutral nouns)
    // only assign a tone when a sentiment word is present; otherwise rely on rating.
    if (positive || negative) {
      const score = negative ? 100 - ratingScore : ratingScore || 50;
      out.push({ aspect, score, tone: negative ? "negative" : "positive" });
    }
  }

  return out;
}

/**
 * Aggregate many reviews into per-aspect scores 0..100. Aspects with no
 * speaks remain unset (the caller keeps a neutral default for those).
 */
export function analyzeGuestReviews(reviews: ReviewRecord[]): GuestIntelligence {
  if (reviews.length === 0) {
    return { perAspect: {}, positiveCount: 0, negativeCount: 0, totalReviews: 0, positiveRatio: 0 };
  }

  const sums: Record<string, { total: number; n: number }> = {};
  let positiveCount = 0;
  let negativeCount = 0;

  for (const review of reviews) {
    const hits = classifyReview(review);
    for (const hit of hits) {
      const bucket = (sums[hit.aspect] ??= { total: 0, n: 0 });
      bucket.total += hit.score;
      bucket.n += 1;
    }
    if (review.rating >= 4) positiveCount += 1;
    else negativeCount += 1;
  }

  const perAspect: Partial<Record<Aspect, number>> = {};
  for (const key of ASPECTS) {
    const bucket = sums[key];
    if (bucket && bucket.n > 0) perAspect[key] = Math.round(bucket.total / bucket.n);
  }

  return {
    perAspect,
    positiveCount,
    negativeCount,
    totalReviews: reviews.length,
    positiveRatio: positiveCount / reviews.length,
  };
}

/** Shorthand: wrap raw text into a ReviewRecord (used by demos/tests). */
export function demoReview(platform: PlatformKey, rating: number, text: string, i: number): ReviewRecord {
  return { id: `demo-${i}`, platform, rating, date: new Date().toISOString(), text };
}

/**
 * Reduce analyzed guest intelligence into a scored `QualitySignals` object.
 * Returns `undefined` when no core aspect was actually mentioned, so callers
 * keep the neutral default instead of inventing data.
 */
export function qualitySignalsFromGuest(
  intelligence: GuestIntelligence,
): QualitySignals | undefined {
  const scores: QualitySignals = {
    service: 50,
    cleanliness: 50,
    valueForMoney: 50,
    location: 50,
    facilities: 50,
  };
  let anyCore = false;
  for (const aspect of CORE_ASPECTS) {
    const v = intelligence.perAspect[aspect];
    if (v != null) {
      scores[aspect] = v;
      anyCore = true;
    }
  }
  return anyCore ? scores : undefined;
}