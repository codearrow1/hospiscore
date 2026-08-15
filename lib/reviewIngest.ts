import type { ReviewRecord } from "@/lib/nlp";
import { reviewsFor } from "@/lib/guestReviews";
import { CONFIG } from "@/lib/config";

/**
 * Review-text ingest (server-only).
 *
 * Turns provider review text into `ReviewRecord`s for sentiment analysis and
 * AI reply drafts. Demo mode returns the seeded reviews; live providers
 * (stayapi/apify) supply real text and degrade to the seeded set on failure so
 * the page is never blank.
 */

export interface ReviewIngestLookup {
  propertyName: string;
  /** Demo slug, when known — enables the offline fallback. */
  slug?: string;
  placeId?: string;
  city?: string;
}

interface ProviderReview {
  platform?: string;
  author?: string;
  rating?: number;
  date?: string;
  text?: string;
}

/** StayAPI-style raw review-text endpoint (adapt to your plan's contract). */
async function fetchStayApiText(input: ReviewIngestLookup): Promise<ReviewRecord[]> {
  if (!input.placeId) return [];
  const url = `${CONFIG.reviewBaseUrl}/hotels/${encodeURIComponent(input.placeId)}/reviews/text`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CONFIG.reviewApiKey}` },
  });
  if (!res.ok) throw new Error(`Review text failed (${res.status})`);
  const data = (await res.json()) as { reviews?: ProviderReview[] };
  return toRecords(data.reviews ?? []);
}

/**
 * Apify actor review-text ingest.
 *
 * Reads the latest scheduled run's dataset via the Apify Read API:
 *   GET {base}/v2/datasets/{datasetId}/items?token={token}&limit=200
 * Row shapes vary by actor; we accept common Google-Maps/booking-review fields
 * and ignore rows without usable text.
 */
async function fetchApifyText(): Promise<ReviewRecord[]> {
  const dataset = CONFIG.apifyDatasetId;
  const token = CONFIG.reviewApiKey;
  if (!dataset || !token) return [];
  const url = `${CONFIG.apifyBaseUrl}/v2/datasets/${encodeURIComponent(dataset)}/items`;
  const res = await fetch(`${url}?token=${encodeURIComponent(token)}&limit=200`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Apify dataset failed (${res.status})`);
  const rows = (await res.json()) as ApifyRow[];
  return toRecords(
    rows.map((r) => ({
      platform: typeof r.platform === "string" ? r.platform : platformFromUrl(r.url),
      author: r.authorName ?? r.reviewerName ?? r.author,
      rating: r.rating ?? r.stars ?? r.reviewStars,
      date: r.publishedAtDate ?? r.reviewDate ?? r.createdAt,
      text: r.text ?? r.reviewText ?? r.reviewBody ?? r.content,
    })),
  );
}

interface ApifyRow {
  text?: string;
  reviewText?: string;
  reviewBody?: string;
  content?: string;
  rating?: number;
  stars?: number;
  reviewStars?: number;
  authorName?: string;
  reviewerName?: string;
  author?: string;
  publishedAtDate?: string;
  reviewDate?: string;
  createdAt?: string;
  url?: string;
  platform?: string;
}

function platformFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.toLowerCase();
  if (u.includes("tripadvisor")) return "tripadvisor";
  if (u.includes("booking.com")) return "booking";
  if (u.includes("expedia")) return "expedia";
  if (u.includes("airbnb")) return "airbnb";
  if (u.includes("agoda")) return "agoda";
  if (u.includes("hotels.com")) return "hotels";
  if (u.includes("vrbo")) return "vrbo";
  if (u.includes("hostelworld")) return "hostelworld";
  if (u.includes("trip.com")) return "trip";
  return "google";
}

function toRecords(rows: ProviderReview[]): ReviewRecord[] {
  return rows
    .filter((r) => typeof r.text === "string" && r.text.trim().length > 0)
    .map((r, i) => ({
      id: `ingest-${i}`,
      platform: normalizePlatform(r.platform),
      rating: clampRating(r.rating),
      date: r.date ?? new Date().toISOString(),
      text: r.text!.trim(),
      author: r.author,
    }));
}

function normalizePlatform(p: string | undefined): ReviewRecord["platform"] {
  const key = (p ?? "").toLowerCase().trim();
  if (key.includes("booking")) return "booking";
  if (key.includes("tripadvisor")) return "tripadvisor";
  if (key.includes("expedia")) return "expedia";
  if (key.includes("airbnb")) return "airbnb";
  if (key.includes("agoda")) return "agoda";
  if (key.includes("hotels.com")) return "hotels";
  if (key.includes("vrbo")) return "vrbo";
  if (key.includes("hostelworld")) return "hostelworld";
  if (key.includes("trip.com")) return "trip";
  return "google";
}

function clampRating(r: number | undefined): number {
  if (r == null || Number.isNaN(r)) return 3;
  const n = Math.max(1, Math.min(5, Math.round(r)));
  return n >= 1 && n <= 5 ? n : 3;
}

/**
 * Load review text for a property. Returns provider records when a live
 * provider is configured, otherwise the seeded (demo) reviews.
 */
export async function loadReviewRecords(
  input: ReviewIngestLookup,
): Promise<ReviewRecord[]> {
  const provider = CONFIG.reviewProvider;
  let records: ReviewRecord[] = [];

  if (provider !== "demo") {
    try {
      records =
        provider === "stayapi"
          ? await fetchStayApiText(input)
          : await fetchApifyText();
    } catch (err) {
      console.error("Review text ingest failed, using seeded fallback:", err);
    }
  }

  if (records.length === 0 && input.slug) {
    records = reviewsFor(input.slug);
  }
  return records;
}