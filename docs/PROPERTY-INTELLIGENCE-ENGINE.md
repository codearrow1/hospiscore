# HospiOS — Property Intelligence Engine

> Grounded in the actual code. Sources: `lib/resolver.ts`, `lib/reviewIngest.ts`,
> `lib/scoring.ts`, `lib/nlp.ts`, `lib/report.ts`, `lib/reportEmail.ts`,
> `lib/projects/*`, `lib/providers/google.ts`, `lib/providers/reviews.ts`,
> and the marketing DataFile (`data.json`).

The property intelligence and acquisition engine turns hospitality businesses
into qualified SaaS opportunities while preserving property history and
attribution through the lifecycle.

## Lifecycle

```text
Property Discovery
   ↓
Property Intelligence
   ↓
Property Score
   ↓
Lead
   ↓
Report
   ↓
Property Claim
   ↓
Verification
   ↓
Organization
   ↓
Onboarding
   ↓
Plan Recommendation
   ↓
Subscription
```

## Where things live

- **Lookup / resolver**: `lib/resolver.ts` — property resolution by name/city/
  Google `placeId`.
- **Review ingestion**: `lib/reviewIngest.ts` — normalizes reviews across
  platforms (Booking.com, Google, TripAdvisor, Expedia, Airbnb) with normalized
  ratings across mixed scales (1–5 and 1–10).
- **Scoring**: `lib/scoring.ts` — deterministic, unit-tested engine producing a
  0–100 score with a grade, across weighted signals (rating quality, volume,
  velocity, response rate, platform spread, online presence).
- **NLP / AI replies**: `lib/nlp.ts` — reply draft generation.
- **Reports**: `lib/report.ts`, `lib/reportEmail.ts`, `lib/reportRequest.ts`.
- **Saved searches**: `lib/saved.ts` + `/api/saved/**`.
- **SaaS-side persistence**: `Property` (linked to Google `placeId`, unique)
  and `PropertyClaim` (verification workflow). Scored/report content is derived
  at runtime; leads/demos live in the marketing DataFile, referenced from
  `AffiliateCommission.leadId`.

## Providers

| Provider | Status |
|---|---|
| Google Places (`lib/providers/google.ts`) | **LIVE** |
| OTA reviews (`lib/providers/reviews.ts`) | **DEMO MODE** (mock when no keys) |

Classification discipline: mark every sourced value **verified** vs
**not verified** — never fabricate data that isn't available (`not verified`).

## Public surfaces

- `/free-score`, `/score-check` — public score lead magnets.
- `/properties`, `/property/[id]` — public property pages.
- `components/PropertySearch.tsx`, `components/PropertyScoreView.tsx`,
  `components/PropertyReport.tsx`, `components/ReportEmailForm.tsx`.
- API: `/api/properties/**`, `/api/search/**`, `/api/leads/**`, `/api/report`,
  `/api/marketing/leads/**`.

## SaaS claim/onboarding

- `lib/saas/propertyClaims.ts` — claim-token system (explicit tokens, never
  raw email).
- `lib/saas/propertyVerification.ts` — verification workflow.
- `lib/saas/properties.ts`, `lib/saas/propertyDiscovery.ts`,
  `lib/saas/propertyImport.ts`.
- API: `/api/customer/properties/**`, `/api/saas/claims/**`,
  `/api/saas/properties/**`, `/api/portals/onboarding`.

---

## Live vs demo/fallback

- **LIVE**: Google Places lookup.
- **DEMO/FALLBACK**: OTA review ingestion when no API credentials are set.
- **NOT VERIFIED**: any value marked unverifiable must render as such, never
  as fact.

This honesty rule is a core product principle: **the UI must reflect what the
backend actually supports.**
