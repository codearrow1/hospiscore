/**
 * Central runtime configuration.
 *
 * The app works in two modes:
 *  - `demo` (default): uses the seeded dataset in `lib/data.ts`. No keys needed.
 *  - `live`: Google Places API powers property search/details and a review
 *    provider supplies OTA review signals. Enable by setting
 *    `GOOGLE_PLACES_API_KEY` (and optionally the review provider vars below).
 *
 * All env access is centralized here so providers and routes read one source
 * of truth and stay testable.
 */

import path from "node:path";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export const CONFIG = {
  /** Enables live Google Places lookups. Empty string → demo mode. */
  googlePlacesApiKey: env("GOOGLE_PLACES_API_KEY"),

  /**
   * Review-data provider. Options:
   *  - "demo"  (default): enrich from the seeded dataset only.
   *  - "stayapi": StayAPI-style REST API (`REVIEW_BASE_URL`, `REVIEW_API_KEY`).
   *  - "apify":  Apify actor endpoint (`REVIEW_BASE_URL`, `REVIEW_API_KEY`).
   */
  reviewProvider: env("REVIEW_PROVIDER") || "demo",
  reviewApiKey: env("REVIEW_API_KEY"),
  reviewBaseUrl: env("REVIEW_BASE_URL"),

  /** Whether any live data path is enabled at all. */
  get live() {
    return this.googlePlacesApiKey.length > 0;
  },

  // --- Caching --------------------------------------------------------
  /** "memory" (default) or "redis" (requires CACHE_PROVIDER=redis + REDIS_URL). */
  cacheProvider: env("CACHE_PROVIDER") || "memory",
  redisUrl: env("REDIS_URL"),
  /** Set CACHE_DISABLED=1 to bypass the cache entirely (debugging). */
  enableCache: env("CACHE_DISABLED") !== "1",

  // --- Score history --------------------------------------------------
  /** Directory for file-based score snapshots (default: <project>/var/scores). */
  scoreHistoryDir: env("SCORE_HISTORY_DIR") || path.join(process.cwd(), "var", "scores"),

  // --- DeepSeek (AI reply drafts) --------------------------------------
  /** Optional. Drives AI reply drafts for guest reviews. Empty → offline template. */
  deepseekApiKey: env("DEEPSEEK_API_KEY"),
  deepseekModel: env("DEEPSEEK_MODEL") || "deepseek-chat",
  deepseekBaseUrl: env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",

  // --- Auth & accounts ---------------------------------------------------
  /** JSON file backing users/sessions/saved properties (default <project>/var/data.json). */
  dataFile: env("APP_DATA_FILE") || path.join(process.cwd(), "var", "data.json"),
  /** Session cookie name. */
  sessionCookie: env("APP_SESSION_COOKIE") || "hs_session",
  /** Session lifetime in days. */
  sessionDays: Number(env("APP_SESSION_DAYS") || 30),

  // --- Data persistence backend --------------------------------------------
  /** "file" (default, JSON document) or "sqlite" (requires Node 22.5+/24). */
  dataProvider: env("DATA_PROVIDER") || "file",
  /** SQLite database path (only used when DATA_PROVIDER=sqlite). */
  sqliteFile: env("SQLITE_FILE") || path.join(process.cwd(), "var", "data.db"),

  // --- Apify review-text ingest -------------------------------------------
  /** Dataset ID of a scheduled Apify actor (Google Maps / booking reviews). */
  apifyDatasetId: env("APIFY_DATASET_ID"),
  /** Apify API base (default api.apify.com). */
  apifyBaseUrl: env("APIFY_BASE_URL") || "https://api.apify.com",

  // --- Alert e-mail --------------------------------------------------------
  /** Optional webhook/endpoint that receives alert e-mails (e.g. Resend). */
  alertWebhookUrl: env("ALERT_WEBHOOK_URL"),

  // --- Internal admin access -------------------------------------------------
  /** Comma-separated e-mail addresses allowed to view the internal leads view. */
  adminEmails: env("ADMIN_EMAILS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;

/** Human-readable mode for UI/debugging. */
export function dataMode(): "live" | "demo" {
  return CONFIG.live ? "live" : "demo";
}
