# HospiScore — Hospitality OS

Web app for property owners to check their property's **online presence score**, computed from reviews and visibility across Booking.com, Google, TripAdvisor, Expedia and Airbnb.

## Features

- **Search** any property (name, city, country) and get a 0–100 score with a grade (Poor / Fair / Good / Excellent)
- **Score breakdown** across six weighted signals: rating quality, review volume, review velocity, response rate, platform spread, online presence
- **Per-platform review stats** with normalized ratings across mixed scales (1–5 and 1–10)
- **Owner claim flow** (simulated verification) unlocking a **prioritized action plan** dashboard
- Deterministic, unit-tested scoring engine — easy to swap demo data for live APIs

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Search for a city like `Lisbon`, `Paris` or `Byron Bay`.

## Scripts

| Command              | Purpose                         |
| -------------------- | ------------------------------- |
| `npm run dev`        | Start dev server                |
| `npm run build`      | Production build                |
| `npm run start`      | Run production build            |
| `npm run lint`       | ESLint                          |
| `npm run typecheck`  | TypeScript check (`tsc --noEmit`) |
| `npm test`           | Vitest unit tests               |
| `npm run snapshot`   | Score snapshot worker (daily trends) |

## Architecture

```
app/page.tsx                          Home + search
app/api/search/route.ts               GET /api/search?q=   (server-side search + scoring)
app/api/properties/[id]/route.ts      GET /api/properties/:id  (full score JSON)
app/properties/[slug]/page.tsx        Score page (SSG via generateStaticParams)
app/property/[id]/page.tsx            Live-property score page (dynamic)
app/properties/[slug]/claim/page.tsx  Owner claim flow
app/properties/[slug]/dashboard/page.tsx  Verified-owner action plan
lib/scoring.ts                        Pure scoring engine (weights, normalization, grades)
lib/config.ts                         Env-driven runtime config (demo vs live)
lib/cache.ts                          TTL cache (memory default, optional Redis)
lib/scoreHistory.ts                   File-based score snapshots (trends)
lib/resolver.ts                       Orchestrates Places + review providers into scored results
lib/providers/google.ts               Google Places API (search + place details)
lib/providers/reviews.ts              Review-provider interface (demo, stayapi, apify)
lib/client/maps-loader.ts             Client-side Places Autocomplete loader
lib/data.ts                           Seeded demo properties
lib/types.ts                          Shared types
lib/{scoring,resolver,cache,scoreHistory}.test.ts   Vitest tests
scripts/snapshot.ts                   Daily score-snapshot worker
components/                           ScoreGauge, ScoreBreakdown, ScoreTrend, PlatformRatings, Search, ClaimForm
```

## Scoring model

Score = Σ (component × weight) → 0–100:

| Component         | Weight |
| ----------------- | ------ |
| Rating quality    | 30%    |
| Review volume     | 20%    |
| Review velocity   | 15%    |
| Response rate     | 10%    |
| Platform spread   | 10%    |
| Online presence   | 15%    |

Tune constants in `lib/scoring.ts` (`WEIGHTS`, `TARGETS`). Grades: 85+ Excellent, 70–84 Good, 50–69 Fair, <50 Poor.

## Going live — wiring real data

The app ships in **demo mode** (seeded properties, no network). To power it with
real data, provide keys in `.env.local` (see `.env.example`). The architecture
is provider-based, so the scoring engine is untouched — only the source changes.

### 1. Google Places API (property search + Google signals)

1. Get a key: Google Cloud Console → **APIs & Services → Credentials** → create an
   API key. Restrict it to your app's domain in production.
2. Enable **"Places API (New)"** for that project.
3. Set `GOOGLE_PLACES_API_KEY` in `.env.local`.
4. That's it — the app flips to live mode:
   - Search (`/api/search?q=…`) now calls Places Text Search and maps each
     result (rating, review count, website) plus Google presence heuristics into
     scoring signals.
   - Each live result links to `/property/place:<placeId>`, a dynamic page that
     resolves full details server-side.
   - No key / provider outage → automatic fallback to demo data.

   Cost notes: Places Text Search ~$32/1k requests, Place Details ~$17/1k.
   The resolver enriches only the top 5 results per query to control spend.

### 2. Review-data provider (OTA reviews)

Google alone only gives you its own rating. For Booking/TripAdvisor/Expedia/Airbnb
signals choose a provider and set:

```
REVIEW_PROVIDER=stayapi        # or "demo" | "apify"
REVIEW_BASE_URL=https://...
REVIEW_API_KEY=...
```

| Provider | What it gives you | Notes |
| -------- | ----------------- | ----- |
| `demo` (default) | OTA signals from the seeded dataset | Offline, useful for matching demo properties |
| `stayapi` | Managed Booking/TripAdvisor/Expedia/Airbnb reviews via API | Clean JSON, webhooks, response-gap stats. Add the expected shape to `lib/providers/reviews.ts` |
| `apify` | Scheduled scrapers for TripAdvisor/Booking/Google Maps | Cheaper at volume, but you own scheduling + parsing |

Implementing a new provider = adding an object matching the `ReviewProvider`
interface and registering it in `getReviewProvider()`. Every live provider
automatically falls back to demo on failure.

### 3. Filling the "unknown" presence signals

Google Places doesn't expose social activity or directory listings. `presence`
fields that can't be sourced are set to neutral/unknown defaults in
`lib/resolver.ts`. For verified (claimed) owners these should come from your PMS
or a reputation vendor — that's the natural integration point.

### 4. Places Autocomplete widget (client)

Set a **separate** client-safe key to get a native dropdown as you type:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

This key must be restricted to your app origin (never reuse the server key).
Enable **"Maps JavaScript API"**. Without it, search silently falls back to the
plain text box. Selecting a prediction loads that exact place's score.

### 5. Caching (save Places quota)

Places lookups are cached behind `lib/cache.ts`:

```
CACHE_PROVIDER=memory      # default, zero-config in-memory TTL cache
# or Redis:
CACHE_PROVIDER=redis
REDIS_URL=redis://localhost:6379
# (requires: npm i redis)
```

Place Details cache 24h, Text Search 1h. `CACHE_DISABLED=1` bypasses for
debugging.

### 6. Score history + snapshot worker

`npm run snapshot` recomputes and persists every property's score as a JSON
snapshot (default `<project>/var/scores`, override with `SCORE_HISTORY_DIR`).
The property page shows a **score-trend sparkline** once ≥2 snapshots exist.

Schedule it daily (e.g. cron):

```
0 2 * * * cd /path/to/app && npm run snapshot >> var/snapshot.log 2>&1
```

In production, snapshot your claimed/live portfolio (from your DB) instead of
the demo dataset.

### 7. Production hardening

- Store claimed-property verification (GBP API) and review-response tracking in
  Postgres.
- Replace `FileScoreStore` with a Postgres implementation behind the same
  `ScoreHistoryStore` interface (`lib/scoreHistory.ts`).
