export type PlatformKey =
  | "google"
  | "booking"
  | "tripadvisor"
  | "expedia"
  | "airbnb"
  | "agoda"
  | "hotels"
  | "vrbo"
  | "hostelworld"
  | "trip";

export type PlatformName =
  | "Google"
  | "Booking.com"
  | "TripAdvisor"
  | "Expedia"
  | "Airbnb"
  | "Agoda"
  | "Hotels.com"
  | "Vrbo"
  | "Hostelworld"
  | "Trip.com";

export const PLATFORM_NAMES: Record<PlatformKey, PlatformName> = {
  google: "Google",
  booking: "Booking.com",
  tripadvisor: "TripAdvisor",
  expedia: "Expedia",
  airbnb: "Airbnb",
  agoda: "Agoda",
  hotels: "Hotels.com",
  vrbo: "Vrbo",
  hostelworld: "Hostelworld",
  trip: "Trip.com",
};

export interface PlatformSignals {
  /** Rating in the platform's own scale (e.g. Google 1-5, Booking 1-10). */
  rating: number;
  /** Native max of the scale, used to normalize (5 or 10). */
  maxRating: number;
  /** Total number of reviews on this platform. */
  reviewCount: number;
  /** Reviews received in the last 30 days. */
  reviewsRecent30: number;
  /** Fraction (0..1) of reviews the property responded to. */
  responseRate: number;
  /** Whether the property has an active listing here. */
  present: boolean;
}

export interface PresenceSignals {
  /** Google Business Profile completeness 0..1 (photos, hours, amenities, about). */
  gbpCompleteness: number;
  /** Website quality 0..100 (SSL, mobile, speed). */
  websiteQuality: number;
  /** Social activity 0..100. */
  socialScore: number;
  /** Number of relevant local directory listings (Yelp, Bing Places, etc.). */
  directoryListings: number;
  /** Whether the property surfaces in the local pack. */
  localPackVisible: boolean;
}

/** Guest-experience dimensions distilled from review sub-ratings, 0..100 each. */
export interface QualitySignals {
  /** Staff & service. */
  service: number;
  /** Cleanliness. */
  cleanliness: number;
  /** Value for money. */
  valueForMoney: number;
  /** Location. */
  location: number;
  /** Facilities (pools, gym, spa, etc.). */
  facilities: number;
}

/** Property-profile & commercial signals, 0..100 unless noted. */
export interface ProfileSignals {
  /** Coverage of key amenities (wifi, parking, restaurant, gym, pool…). */
  amenities: number;
  /** Volume + quality of photos shown across channels. */
  visualContent: number;
  /** Sustainable practices & eco credentials. */
  sustainability: number;
  /** Accessibility for guests with disabilities. */
  accessibility: number;
  /** Share of direct bookings (independence from OTAs). */
  directBookings: number;
  /** How closely the property matches its advertised class/star level. */
  starConsistency: number;
  /** Count of industry awards & recognitions (0..n, mapped to 0..100). */
  awards: number;
}

/** Immutable source signals for a single property. All scoring operates on this. */
export interface RawSignals {
  platforms: Partial<Record<PlatformKey, PlatformSignals>>;
  presence: PresenceSignals;
  quality?: QualitySignals;
  profile?: ProfileSignals;
}

export interface Property {
  slug: string;
  name: string;
  city: string;
  country: string;
  type: string;
  /** Whether the owner has claimed & verified this property. */
  claimed: boolean;
  /** Accent color for UI, e.g. "emerald". */
  color: string;
  signals: RawSignals;
}

/** Result of one scoring sub-category, 0..100. */
export interface ScoreComponent {
  key: string;
  label: string;
  score: number;
  /** Fraction of the total weight this component contributes. */
  weight: number;
  detail: string;
  /** Whether the score is based on real data (vs a neutral default). */
  sourced?: boolean;
}

export type ScoreGrade = "Poor" | "Fair" | "Good" | "Excellent";

export interface ScoreResult {
  overall: number; // 0..100
  grade: ScoreGrade;
  gradeColor: string;
  components: ScoreComponent[];
  /** Estimated total number of reviews across all platforms. */
  totalReviews: number;
  /** Estimated weighted average rating 0..100. */
  averageRating: number;
  platformsCount: number;
  /** 0..100 share of criteria backed by real data (vs neutral defaults). */
  dataCompleteness: number;
  date: string;
}