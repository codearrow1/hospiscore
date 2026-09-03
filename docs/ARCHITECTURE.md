# HospiOS — System Architecture

> Grounded in the actual codebase as inspected. Where an item could not be
> proven from the repository it is marked **NOT VERIFIED**.

## Scope

This document describes the commercially facing HospiOS layers:

1. **Marketing Website**
2. **Growth / Lead Generation**
3. **Property Intelligence**
4. **SaaS Control Plane** (organizations, plans, subscriptions, billing,
   payments, affiliates, partners, franchise, analytics, settings, audit,
   integrations, RBAC, platform administration)

The **main operational PMS application** is deliberately out of scope. The
SaaS layer references an external PMS only through the `Property.pmsInstanceUrl`
link and integration interfaces it requires.

---

## High-level layers

```text
                         ┌─────────────────────────┐
                         │      MARKETING WEB      │
                         └────────────┬────────────┘
                                      ▼
                         ┌─────────────────────────┐
                         │  PROPERTY INTELLIGENCE  │
                         └────────────┬────────────┘
                                      ▼
                         ┌─────────────────────────┐
                         │ CLAIM / ONBOARDING       │
                         └────────────┬────────────┘
                                      ▼
              ┌──────────────────────────────────────────┐
              │            SAAS CONTROL PLANE           │
              └──────────────┬───────────────────────────┘
                             ▼
                    ┌────────────────────────┐
                    │     PRISMA (SQLite)    │
                    └────────────────────────┘
```

The SaaS Control Plane uses Next.js App Router pages under `app/saas/**` and a
domain/service layer under `lib/saas/**`, persisted through a Prisma schema
(`prisma/schema.prisma`, SQLite provider today, `DATABASE_URL` managed).

---

## Repository layout

```
app/                   Next.js App Router
├── api/               API route handlers (154 route files; see Route map)
├── saas/              SaaS Control Plane UI (orgs, plans, subs, billing, affiliates…)
├── marketing-admin/   Marketing admin UI
├── partner/ affiliate/ customer/ dashboard/ subadmin/ staff/
├── account/           User account (profile, security, preferences)
└── <public>/          about, platform, pricing, solutions, blog, faq, security, …
components/
├── marketing/         Shared marketing components + design system
└── …                  Feature/portal components
lib/
├── saas/              SaaS domain/services (billing, payments, affiliates, …)
│   └── payments/      Provider-neutral payment gateway abstraction
├── providers/         External integrations (google.ts live, reviews.ts demo-mode)
├── marketing/         Marketing data / roles / analytics
└── …                  auth, rbac, scoring, resolver, reviewIngest, data, …
prisma/
├── schema.prisma      46 models (orgs, plans, subs, billing, affiliates, …)
└── migrations/        Versioned migrations
scripts/               Diagnostics, seeding, launch-check, smoke, sandbox
docs/                  Architecture & operational documentation
```

---

## Marketing Website

Public, unauthenticated pages under `app/*` (e.g. `/platform`, `/pricing`,
`/solutions`, `/blog`, `/faq`, `/security`, `/integrations`, `/about`,
`/case-studies`, `/knowledge-base`, `/news`, `/product-updates`,
`/product-videos`, `/careers`, `/migration`, `/alternatives`, `/terms`,
`/privacy`, plus `/properties`, `/property` and `/ref`). Shared components
live in `components/marketing/**`. Open Graph images served from `app/og/**`.
Site-wide metadata in `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`
(JSON-LD organization schema).

Conversion entry points are `/demo`, `/free-score`, and `/score-check`.

---

## Growth / Lead Generation

- `/demo` — book-a-demo form (`components/BookDemoForm.tsx`), POSTs to
  `/api/demo` (`lib/demo.ts`).
- `/free-score` and `/score-check` — property score lead magnets.
- `/marketing-admin` — internal marketing administration surface backed by
  `/api/marketing/*` (stats, export, audit, track, users, leads, campaigns,
  forms, demos) and `/api/leads/*`.
- Contact form (`components/ContactForm.tsx`) posts to `/api/demo`.

Leads/demos/pipeline are tracked through `/api/marketing/leads/**` and the
marketing DataFile (`data.json`); there is no dedicated schema table for these
(see `docs/PROPERTY-INTELLIGENCE-ENGINE.md`).

---

## Property Intelligence

Property intelligence (Google Places lookup, review ingest, scoring, report
generation, AI reply drafts) is implemented in `lib/resolver.ts`,
`lib/reviewIngest.ts`, `lib/nlp.ts`, `lib/scoring.ts`, `lib/projects` and
`lib/providers/google.ts`. Google Places is a **LIVE** integration;
OTA reviews use a **demo-mode** provider returning mock data when no API keys
are configured. Persisted tenant data lives in the `Property` and
`PropertyClaim` models; scoring/report content is derived at runtime.

---

## SaaS Control Plane (`app/saas/**`, `lib/saas/**`)

The commercial and administrative core. Representative route modules under
`app/saas/`:

`organizations`, `organizations/[id]`, `organization`, `organization/billing`,
`organization/team`, `properties`, `plans`, `plan-approvals`, `subscriptions`,
`subscription-requests`, `billing`, `coupons`, `dunning`, `usage`,
`financial-approvals`, `payments` (providers), `affiliates`, `partners`,
`campaigns`, `franchise`, `fraud`, `audit`, `feature-flags`, `settings`,
`onboarding`, `roles`, `support`.

Domain services in `lib/saas/**`:

| Domain | Key modules |
|---|---|
| Organizations | `organizations.ts`, `plans.ts`, `planCatalog.ts`, `planSync.ts`, `subscriptionPlan.ts`, `init.ts` |
| Subscriptions / lifecycle | `subscriptions.ts`, `customerSubscription.ts`, `lifecycle.ts`, `onboarding.ts`, `demoMonth.ts` |
| Billing / usage | `billing.ts`, `invoices.ts`, `usage.ts`, `usageBilling.ts`, `dunning.ts`, `coupons.ts` |
| Payments | `payments.ts`, `gateway.ts`, `financialApproval.ts`, `payments/**` |
| Affiliates / growth | `affiliates.ts`, `commissions.ts`, `recurringCommissions.ts`, `payouts.ts`, `payoutEngine.ts`, `attribution.ts`, `multiTier.ts`, `campaigns.ts`, `partners.ts` |
| Franchise | `franchise.ts`, `franchisePayouts.ts` |
| Property SaaS | `properties.ts`, `propertyClaims.ts`, `propertyVerification.ts`, `propertyDiscovery.ts`, `propertyImport.ts` |
| Trust & ops | `fraud.ts`, `audit.ts`, `roles.ts`, `notifications.ts`, `settings.ts`, `support.ts`, `ticketRules.ts`, `portalLinks.ts`, `portalAccess.ts`, `analytics.ts`, `metrics.ts`, `health.ts`, `automation.ts`, `cronAuth.ts` |

---

## Payments

Provider-neutral. The gateway orchestrator (`lib/saas/gateway.ts`) is the
mandatory path for invoice/payment creation. Provider adapters extend
`BasePaymentAdapter` in `lib/saas/adapters/*` (stripe, razorpay, paypal, adyen,
cashfree, payu, checkout.com, square, mollie, phonepe, paytm, easebuzz +
generic). Registry/capabilities in `lib/saas/payments/{catalog,capabilityMatrix}.ts`;
intent flow, validation, routing, recon, health, crypto in `lib/saas/payments/**`.

**Implementations are wired, not necessarily LIVE.** Live activation is
explicitly controlled via `confirmLiveActivation` in
`SystemSetting("payment_providers")`. Do not treat a provider as live just
because code exists. See `docs/SAAS-INTEGRATIONS.md`.

---

## Affiliates / Partners / Franchise

- **Affiliates**: persistent attribution chain (click → lead → claim →
  organization → subscription → commission → eligibility → payout). Models:
  `Affiliate`, `AffiliateClick`, `AffiliateCampaign`, `AffiliateCommission`,
  `AffiliatePayout`, `AffiliateAttribution`, `AffiliateRecruitment`,
  `AffiliatePerformanceTier`, `AffiliateApplication`, `AffiliateFraudCase`,
  `AffiliateAgreement`, `AffiliateAsset`, `AffiliateNotification`,
  `AffiliateCampaignMember`, `AffiliateSetting`.
- **Partners**: reseller/consultant commission model (`Partner`,
  `AffiliateCommission` scoped to `partnerId`, `AffiliatePayout`).
- **Franchise**: `Franchisee`, `FranchiseTerritory` (tree), `FranchisePayout`.

---

## Multi-tenant model

```text
Platform
   ↓
Organization   ← primary tenant
   ↓
Property
   ↓
Membership / Users / Business Data
```

Requests must not escape their permitted organization/property context.
Management surfaces apply SaaS/marketing role checks
(`lib/rbac.ts`, `lib/saas/roles.ts`) and portal access guards
(`lib/saas/portalAccess.ts`). See `docs/SAAS-RBAC-MATRIX.md`.

---

## Data & persistence

Prisma schema (`prisma/schema.prisma`, 46 models, SQLite, no enums — controlled
vocabularies are `String` with documented values). Grounded model inventory is
maintained in `docs/SAAS-MANAGEMENT-ARCHITECTURE.md`. Migrations are versioned
under `prisma/migrations/`. Production schema evolution uses `prisma migrate
deploy` (never `prisma db push`).

---

## API surface

154 API route handler files. Groups: `auth`, `account`, `customer`, `demo`,
`saas` (largest, 88 files), `marketing`, `affiliate`, `partner`, `properties`,
`leads`, `saved`, `search`, `pricing`, `admin`, plus `/api/health`,
`/api/settings`, `/api/reply`, `/api/report`,
`/api/payments/webhook/[provider]`, `/api/portals/onboarding`.

---

## Testing & quality

- Unit tests colocated in `lib/**` (`*.test.ts`), run via Vitest.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- Runtime/browser verification harnesses (see `scripts/` and the
  `launch:check` / `smoke` scripts).

See `CONTRIBUTING.md` for the full quality gate list.
