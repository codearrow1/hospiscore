import type { QualitySignals, RawSignals } from "./types";
import { computeScore } from "./scoring";
import { datasetBenchmark, datasetOverall } from "./benchmark";

export interface ReportPoint {
  key: string;
  title: string;
  body: string;
  score: number;
}

export interface MarketView {
  peerCount: number;
  peerAverage: number;
  peerBest: number;
  overallDelta: number;
  aboveAverage: number;
  belowAverage: number;
  rankPosition: number;
}

export interface ReportData {
  headline: string;
  strengths: ReportPoint[];
  watchouts: ReportPoint[];
  risks: ReportPoint[];
  servicesPositive: ReportPoint[];
  servicesNegative: ReportPoint[];
  platformsCount: number;
  totalReviews: number;
  market: MarketView;
}

const STRENGTH_BODY: Record<string, string> = {
  ratingQuality: "Guests rate you well across your live channels. Keep the standards up.",
  reviewVolume: "A strong, trustworthy base of guest reviews to study.",
  reviewVelocity: "Guest chatter is active right now — the listing looks alive.",
  responseRate: "You reply to nearly every guest, and guests notice.",
  platformDiversity: "Your listing is visible across many major platforms.",
  guestExperience: "Service, cleanliness, value, location and facilities land well.",
  presence: "Your profile, website and directories are complete and visible.",
  amenities: "The amenities you advertise are consistently delivered.",
  visualContent: "Strong, current photo and media coverage on your listings.",
  sustainability: "Eco practices are showcased — guests increasingly reward this.",
  accessibility: "The property welcomes guests with reduced mobility.",
  directBookings: "You convert a healthy share of direct bookings, protecting margins.",
  brandTrust: "What you advertise matches the class you actually deliver.",
};

const WATCHOUT_BODY: Record<string, string> = {
  ratingQuality: "Ratings drag toward the low end — recurring complaints may be unaddressed.",
  reviewVolume: "Review volume is thin, so your numbers read as less trustworthy.",
  reviewVelocity: "New reviews have slowed, which makes the listing look stale.",
  responseRate: "Reviews are going unanswered, which reads as neglect.",
  platformDiversity: "Your reputation rests on too few platforms — spread it around.",
  guestExperience: "Parts of the stay experience are fraying relative to your class.",
  presence: "Your profile, website or directories look incomplete.",
  amenities: "Key amenities are silent or under-delivered on your listing.",
  visualContent: "Photos and media are thin or dated.",
  sustainability: "Eco credentials are not surfaced — an easy credibility win.",
  accessibility: "Limited accessibility excludes a meaningful share of guests.",
  directBookings: "Heavy OTA dependence is squeezing your margins.",
  brandTrust: "Advertised class and delivered quality are out of step.",
};

const SERVICE_DIMS: { key: keyof QualitySignals; title: string }[] = [
  { key: "service", title: "Staff & service" },
  { key: "cleanliness", title: "Cleanliness" },
  { key: "valueForMoney", title: "Value for money" },
  { key: "location", title: "Location" },
  { key: "facilities", title: "Facilities" },
];

function serviceBody(value: number) {
  if (value >= 70) return `scored ${value}/100 from guest sub-scores — a real strength on this stay.`;
  if (value < 55) return `scored ${value}/100 — this is a sticking point in guest reviews.`;
  return `scored ${value}/100 — solid, but a step below where it could be.`;
}

export function buildReport(propertyName: string, signals: RawSignals): ReportData {
  const result = computeScore(signals);
  const benchmark = datasetBenchmark();

  const strengths: ReportPoint[] = [];
  const watchouts: ReportPoint[] = [];
  const risks: ReportPoint[] = [];

  for (const c of result.components) {
    if (c.score >= 70) {
      strengths.push({
        key: c.key,
        title: c.label,
        body: STRENGTH_BODY[c.key] ?? "A clear strength for this property.",
        score: c.score,
      });
    } else if (c.score < 50) {
      risks.push({
        key: c.key,
        title: c.label,
        body: WATCHOUT_BODY[c.key] ?? "Well below the bar on this signal.",
        score: c.score,
      });
    } else {
      watchouts.push({
        key: c.key,
        title: c.label,
        body: WATCHOUT_BODY[c.key] ?? "Fair here — a modest nudge would lift the overall score.",
        score: c.score,
      });
    }
  }

  const servicesPositive: ReportPoint[] = [];
  const servicesNegative: ReportPoint[] = [];
  if (signals.quality) {
    for (const d of SERVICE_DIMS) {
      const v = signals.quality[d.key];
      if (v >= 70) servicesPositive.push({ key: d.key, title: d.title, body: serviceBody(v), score: v });
      else if (v < 55) servicesNegative.push({ key: d.key, title: d.title, body: serviceBody(v), score: v });
    }
  }

  const strongest = [...result.components].sort((a, b) => b.score - a.score)[0];
  const weakest = [...result.components].sort((a, b) => a.score - b.score)[0];

  const aboveAverage = result.components.filter(
    (c) => c.score >= (benchmark.byKey[c.key]?.average ?? 50),
  ).length;
  const beatenBy = datasetOverall().filter((s) => s > result.overall).length;

  return {
    headline: `${propertyName} scores ${result.overall}/100 (${result.grade}). Its strongest signal is${
      strongest ? ` ${strongest.label.toLowerCase()} (${strongest.score})` : ""
    }${weakest ? `, while ${weakest.label.toLowerCase()} (${weakest.score}) holds it back most` : ""}.`,
    strengths: strengths.sort((a, b) => b.score - a.score),
    watchouts: watchouts.sort((a, b) => a.score - b.score),
    risks: risks.sort((a, b) => a.score - b.score),
    servicesPositive,
    servicesNegative,
    platformsCount: result.platformsCount,
    totalReviews: result.totalReviews,
    market: {
      peerCount: benchmark.propertyCount,
      peerAverage: benchmark.overallAverage,
      peerBest: benchmark.overallBest,
      overallDelta: result.overall - benchmark.overallAverage,
      aboveAverage,
      belowAverage: result.components.length - aboveAverage,
      rankPosition: beatenBy,
    },
  };
}