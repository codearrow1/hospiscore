import type {
  PlatformKey,
  PresenceSignals,
  QualitySignals,
  RawSignals,
  ScoreComponent,
  ScoreGrade,
  ScoreResult,
} from "./types";

export const TOTAL_PLATFORMS: PlatformKey[] = [
  "google",
  "booking",
  "tripadvisor",
  "expedia",
  "airbnb",
  "agoda",
  "hotels",
  "vrbo",
  "hostelworld",
  "trip",
];

/**
 * Industry-informed weights across 13 criteria. Reviews still dominate, but the
 * model now also rewards guest-experience dimensions (service, cleanliness,
 * value, location, facilities) and property profile (amenities, visuals,
 * sustainability, accessibility, direct bookings, class consistency).
 * Tune these to match your commercial model.
 */
export const WEIGHTS = {
  ratingQuality: 0.22,
  reviewVolume: 0.13,
  reviewVelocity: 0.08,
  responseRate: 0.06,
  platformDiversity: 0.05,
  guestExperience: 0.16,
  presence: 0.08,
  amenities: 0.05,
  visualContent: 0.05,
  sustainability: 0.04,
  accessibility: 0.03,
  directBookings: 0.03,
  brandTrust: 0.02,
} as const;

/**
 * Baseline volumes used to scale raw counts to a 0..100 score.
 * A property at (or above) the target hits 100 for that sub-category.
 */
export const TARGETS = {
  volume: 300, // total reviews to max out "review volume"
  velocity: 60, // recent-30 reviews to max out "velocity"
  estimatedTotalRating: 150, // sample size for rating confidence
  awardsMax: 5, // award count that maps to a perfect score
};

/** Neutral value used when a signal group is missing (never punishes/honors). */
const NEUTRAL = 50;

export function gradeForScore(score: number): ScoreGrade {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

const GRADE_COLORS: Record<ScoreGrade, string> = {
  Poor: "#dc2626",
  Fair: "#f59e0b",
  Good: "#10b981",
  Excellent: "#2563eb",
};

export function gradeColor(grade: ScoreGrade): string {
  return GRADE_COLORS[grade];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

interface NumericNonEmpty {
  maxRating: number;
  rating: number;
  reviewCount: number;
  reviewsRecent30: number;
  responseRate: number;
}

/** Platforms that actually have a listing present. */
function activePlatforms(signals: RawSignals): PlatformKey[] {
  return TOTAL_PLATFORMS.filter((key) => signals.platforms[key]?.present);
}

/**
 * Core scoring. Pure and deterministic — no I/O, no Date.now fallback except
 * the injected `now` for a stable, testable snapshot date.
 */
export function computeScore(signals: RawSignals, now = new Date()): ScoreResult {
  const platforms = activePlatforms(signals);
  const presence = signals.presence;
  const hasQuality = Boolean(signals.quality);
  const hasProfile = Boolean(signals.profile);

  const components: ScoreComponent[] = [
    {
      key: "ratingQuality",
      label: "Rating quality",
      score: scoreRatingQuality(signals, platforms),
      weight: WEIGHTS.ratingQuality,
      detail: detailRatingQuality(signals, platforms),
      sourced: platforms.length > 0,
    },
    {
      key: "reviewVolume",
      label: "Review volume",
      score: scoreReviewVolume(signals, platforms),
      weight: WEIGHTS.reviewVolume,
      detail: detailReviewVolume(signals, platforms),
      sourced: platforms.length > 0,
    },
    {
      key: "reviewVelocity",
      label: "Review velocity",
      score: scoreReviewVelocity(signals, platforms),
      weight: WEIGHTS.reviewVelocity,
      detail: detailReviewVelocity(signals, platforms),
      sourced: platforms.length > 0,
    },
    {
      key: "responseRate",
      label: "Response rate",
      score: scoreResponseRate(signals, platforms),
      weight: WEIGHTS.responseRate,
      detail: detailResponseRate(signals, platforms),
      sourced: platforms.length > 0,
    },
    {
      key: "platformDiversity",
      label: "Platform spread",
      score: scorePlatformDiversity(platforms.length),
      weight: WEIGHTS.platformDiversity,
      detail: `${platforms.length} of ${TOTAL_PLATFORMS.length} platforms active`,
      sourced: true,
    },
    {
      key: "guestExperience",
      label: "Guest experience",
      score: scoreGuestExperience(signals.quality),
      weight: WEIGHTS.guestExperience,
      detail: detailQuality(signals.quality),
      sourced: hasQuality,
    },
    {
      key: "presence",
      label: "Online presence",
      score: scorePresence(presence),
      weight: WEIGHTS.presence,
      detail: detailPresence(presence),
      sourced: true,
    },
    {
      key: "amenities",
      label: "Amenities & facilities",
      score: scoreProfileSignal(signals.profile, "amenities"),
      weight: WEIGHTS.amenities,
      detail: profileDetail("amenities", "Coverage of wifi, parking, dining, pool, gym"),
      sourced: hasProfile,
    },
    {
      key: "visualContent",
      label: "Photos & media",
      score: scoreProfileSignal(signals.profile, "visualContent"),
      weight: WEIGHTS.visualContent,
      detail: profileDetail("visualContent", "Volume & quality of photos across channels"),
      sourced: hasProfile,
    },
    {
      key: "sustainability",
      label: "Sustainability",
      score: scoreProfileSignal(signals.profile, "sustainability"),
      weight: WEIGHTS.sustainability,
      detail: profileDetail("sustainability", "Eco practices & credentials"),
      sourced: hasProfile,
    },
    {
      key: "accessibility",
      label: "Accessibility",
      score: scoreProfileSignal(signals.profile, "accessibility"),
      weight: WEIGHTS.accessibility,
      detail: profileDetail("accessibility", "Accessibility for guests with disabilities"),
      sourced: hasProfile,
    },
    {
      key: "directBookings",
      label: "Direct bookings",
      score: scoreProfileSignal(signals.profile, "directBookings"),
      weight: WEIGHTS.directBookings,
      detail: profileDetail("directBookings", "Share of bookings made directly"),
      sourced: hasProfile,
    },
    {
      key: "brandTrust",
      label: "Class & recognition",
      score: scoreBrandTrust(signals.profile),
      weight: WEIGHTS.brandTrust,
      detail: detailBrandTrust(signals.profile),
      sourced: hasProfile,
    },
  ];

  const overall = clamp(
    components.reduce((sum, c) => sum + c.score * c.weight, 0),
  );
  const grade = gradeForScore(overall);

  const totalReviews = nonEmpty(signals, platforms).reduce(
    (sum, r) => sum + r.reviewCount,
    0,
  );
  const sourced = components.filter((c) => c.sourced).length;

  return {
    overall: Math.round(overall),
    grade,
    gradeColor: gradeColor(grade),
    components,
    totalReviews,
    averageRating: Math.round(meanRatingScaled(signals, platforms) * 100),
    platformsCount: platforms.length,
    dataCompleteness: Math.round((sourced / components.length) * 100),
    date: now.toISOString(),
  };
}

function nonEmpty(signals: RawSignals, keys: PlatformKey[]): NumericNonEmpty[] {
  return keys
    .map((k) => signals.platforms[k])
    .filter((p): p is NumericNonEmpty & typeof p => Boolean(p?.present))
    .map((p) => ({
      maxRating: p.maxRating,
      rating: p.rating,
      reviewCount: p.reviewCount,
      reviewsRecent30: p.reviewsRecent30,
      responseRate: p.responseRate,
    }));
}

function weightedMetric(
  rows: NumericNonEmpty[],
  pick: (r: NumericNonEmpty) => number,
): { value: number; totalWeight: number } {
  let value = 0;
  let totalWeight = 0;
  for (const r of rows) {
    const w = r.reviewCount;
    value += pick(r) * w;
    totalWeight += w;
  }
  return { value, totalWeight: totalWeight || 1 };
}

/** Weighted average normalized rating on a 0..1 scale, weighted by review count. */
function meanRatingScaled(
  signals: RawSignals,
  platforms: PlatformKey[],
): number {
  const rows = nonEmpty(signals, platforms);
  if (rows.length === 0) return 0;
  const { value, totalWeight } = weightedMetric(rows, (r) => r.rating / r.maxRating);
  return value / totalWeight;
}

function scoreRatingQuality(signals: RawSignals, platforms: PlatformKey[]): number {
  if (platforms.length === 0) return 0;
  const mean = meanRatingScaled(signals, platforms); // 0..1

  // Confidence: low sample sizes shouldn't be trusted as much.
  const { totalWeight } = weightedMetric(nonEmpty(signals, platforms), () => 1);
  const confidence = clamp((totalWeight / TARGETS.estimatedTotalRating) * 100, 0, 100) / 100;
  const blended = mean * (0.6 + 0.4 * confidence);
  return Math.round(clamp(blended * 100));
}

function scoreReviewVolume(signals: RawSignals, platforms: PlatformKey[]): number {
  const total = nonEmpty(signals, platforms).reduce((s, r) => s + r.reviewCount, 0);
  return Math.round(clamp((total / TARGETS.volume) * 100));
}

function scoreReviewVelocity(signals: RawSignals, platforms: PlatformKey[]): number {
  const rows = nonEmpty(signals, platforms);
  const recent = rows.reduce((s, r) => s + r.reviewsRecent30, 0);
  // Weight velocity by the property's relative scale so a 20-review month on a
  // quiet listing isn't penalized against a busy city hotel.
  const total = rows.reduce((s, r) => s + r.reviewCount, 0) || 1;
  const activity = (recent / total) * 100;
  return Math.round(clamp(activity * 4)); // ~25%/month recency = 100
}

function scoreResponseRate(signals: RawSignals, platforms: PlatformKey[]): number {
  const rows = nonEmpty(signals, platforms);
  if (rows.length === 0) return 0;
  const { value, totalWeight } = weightedMetric(rows, (r) => r.responseRate);
  return Math.round(clamp((value / totalWeight) * 100));
}

function scorePlatformDiversity(active: number): number {
  return Math.round(clamp((active / TOTAL_PLATFORMS.length) * 100));
}

const QUALITY_DIMS: (keyof QualitySignals)[] = [
  "service",
  "cleanliness",
  "valueForMoney",
  "location",
  "facilities",
];

function scoreGuestExperience(quality?: QualitySignals): number {
  if (!quality) return NEUTRAL;
  const values = QUALITY_DIMS.map((k) => clamp(quality[k]));
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

function scoreProfileSignal(
  profile: RawSignals["profile"],
  key: "amenities" | "visualContent" | "sustainability" | "accessibility" | "directBookings",
): number {
  if (!profile) return NEUTRAL;
  return Math.round(clamp(profile[key]));
}

function scoreBrandTrust(profile: RawSignals["profile"]): number {
  if (!profile) return NEUTRAL;
  const stars = clamp(profile.starConsistency);
  const awards = clamp((profile.awards / TARGETS.awardsMax) * 100);
  return Math.round((stars * 0.6 + awards * 0.4) / 1);
}

function scorePresence(p: PresenceSignals): number {
  const parts = [
    p.gbpCompleteness * 100,
    p.websiteQuality,
    p.socialScore,
    (p.directoryListings >= 3 ? 100 : p.directoryListings / 3) * 100,
    p.localPackVisible ? 100 : 0,
  ];
  return Math.round(clamp(parts.reduce((s, x) => s + x, 0) / parts.length));
}

/* ------------- Human-readable detail strings for the UI ------------- */

function detailRatingQuality(signals: RawSignals, platforms: PlatformKey[]): string {
  if (platforms.length === 0) return "No active review platforms";
  const m = meanRatingScaled(signals, platforms) * 5;
  return `~${m.toFixed(1)}/5 weighted average across ${platforms.length} platform${
    platforms.length > 1 ? "s" : ""
  }`;
}

function detailReviewVolume(signals: RawSignals, platforms: PlatformKey[]): string {
  const total = nonEmpty(signals, platforms).reduce((s, r) => s + r.reviewCount, 0);
  return `${total.toLocaleString()} total reviews (target ${TARGETS.volume})`;
}

function detailReviewVelocity(signals: RawSignals, platforms: PlatformKey[]): string {
  const rows = nonEmpty(signals, platforms);
  const recent = rows.reduce((s, r) => s + r.reviewsRecent30, 0);
  const total = rows.reduce((s, r) => s + r.reviewCount, 0) || 0;
  return `${recent} new in the last 30 days (${total ? Math.round((recent / total) * 100) : 0}% of all)`;
}

function detailResponseRate(signals: RawSignals, platforms: PlatformKey[]): string {
  const rows = nonEmpty(signals, platforms);
  if (rows.length === 0) return "No active review platforms";
  const { value, totalWeight } = weightedMetric(rows, (r) => r.responseRate);
  return `${Math.round((value / totalWeight) * 100)}% of reviews responded to`;
}

function detailQuality(quality?: QualitySignals): string {
  if (!quality) return "Not enough data — neutral 50";
  return QUALITY_DIMS.map((k) => `${k.replace(/[A-Z]/g, " $&")} ${quality[k]}`).join(" · ");
}

function detailPresence(p: PresenceSignals): string {
  const bits: string[] = [];
  if (p.gbpCompleteness >= 0.85) bits.push("complete profile");
  else if (p.gbpCompleteness >= 0.5) bits.push("partial profile");
  else bits.push("incomplete profile");
  bits.push(`website ${p.websiteQuality}/100`);
  bits.push(`social ${p.socialScore}/100`);
  bits.push(`${p.directoryListings} directory listings`);
  bits.push(p.localPackVisible ? "in local pack" : "not in local pack");
  return bits.join(" · ");
}

const PROFILE_DETAIL: Record<string, string> = {
  amenities: "Coverage of wifi, parking, dining, pool, gym",
  visualContent: "Volume & quality of photos across channels",
  sustainability: "Eco practices & credentials",
  accessibility: "Accessibility for guests with disabilities",
  directBookings: "Share of bookings made directly",
};

function profileDetail(key: string, fallback: string): string {
  if (!PROFILE_DETAIL[key]) return fallback;
  return `${PROFILE_DETAIL[key]} — neutral 50 if unmeasured`;
}

function detailBrandTrust(profile: RawSignals["profile"]): string {
  if (!profile) return "Not enough data — neutral 50";
  return `Star consistency ${Math.round(clamp(profile.starConsistency))}/100 · ${profile.awards} award${
    profile.awards === 1 ? "" : "s"
  }`;
}
