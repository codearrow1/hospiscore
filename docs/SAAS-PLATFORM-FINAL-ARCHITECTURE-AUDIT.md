# HospiOS — SaaS Platform Final Architecture Audit

> Generated from direct inspection of the repository. Where something could not
> be proven from the code it is marked **NOT VERIFIED**. This document is the
> senior-developer handoff for the **commercial HospiOS platform** (marketing +
> growth + SaaS control plane). The main operational PMS is out of scope.

---

## 1. Executive summary

HospiOS is a Next.js (App Router) + TypeScript + Prisma application combining:

1. A public **marketing website** (`app/*`).
2. A **growth/lead-generation** layer (`/demo`, `/free-score`, `/score-check`,
   `/marketing-admin`).
3. A **property intelligence** engine (scoring, reviews, reports, claims).
4. A substantial **SaaS Control Plane** (`app/saas/**`, `lib/saas/**`,
   `app/api/saas/**`) for organizations, plans, subscriptions, billing,
   payments, affiliates, partners, franchise, analytics, audit, RBAC and
   platform administration.

Strengths: provider-neutral payment gateway, idempotent ledger with immutable
audit, four-eyes financial approvals, explicit-claim portal identity, honest
integration readiness discipline, and a large tested surface. Main risks:
persistence is single-provider (SQLite) with no dedicated User/Role/Lead tables
(all handled in code), and provider readiness coverage is uneven.

---

## 2. Repository structure

`app/`, `components/`, `lib/`, `lib/saas/` (+ `lib/saas/payments/`),
`lib/providers/`, `lib/generated/prisma`, `prisma/`, `scripts/`, `docs/`.
See `docs/ARCHITECTURE.md` for the full layout.

---

## 3. Marketing architecture

- Public routes: `/`, `/about`, `/platform`, `/pricing`, `/solutions`,
  `/integrations`, `/faq`, `/blog`, `/case-studies`, `/knowledge-base`,
  `/news`, `/product-updates`, `/product-videos`, `/careers`, `/migration`,
  `/alternatives`, `/security`, `/terms`, `/privacy`, `/properties`,
  `/property/[id]`, `/ref`, `/og`.
- Shared marketing design system in `components/marketing/**`; dark,
  zinc-based styling independent of `html.dark` state.
- See `docs/MARKETING-ARCHITECTURE.md`.

## 4. Property intelligence

- Google Places lookup (`lib/providers/google.ts`) — **LIVE**.
- OTA reviews (`lib/providers/reviews.ts`) — **DEMO MODE** (mock without keys).
- Scoring (`lib/scoring.ts`), resolver, review ingest, report, AI replies.
- SaaS-side persistence: `Property`, `PropertyClaim`.
- See `docs/PROPERTY-INTELLIGENCE-ENGINE.md`.

## 5. Growth / CRM

- `app/marketing-admin/**` + `/api/marketing/**` and `/api/leads/**`.
- Leads/demos/forms/campaigns/pipeline; data in the marketing DataFile.
- Conversion: `/demo`, `/free-score`, `/score-check`, `BookDemoForm`,
  `ContactForm`.
- **No dedicated `Lead`/`Demo` schema tables** — they live in the DataFile and
  are referenced from `AffiliateCommission.leadId`. **NOT VERIFIED** that this
  scales to production-grade CRM volume.

## 6. SaaS Control Plane

`app/saas/**` with `lib/saas/**` services: organizations, plans, plan-sync,
subscriptions, lifecycle, onboarding, entitlements, billing, invoices, usage,
usage-billing, dunning, coupons, payments, gateway, financial-approval,
affiliates, commissions, recurring-commissions, payouts, payout-engine,
attribution, multi-tier, campaigns, partners, franchise, franchise-payouts,
properties, property-claims, property-verification, property-discovery,
property-import, fraud, audit, roles, notifications, settings, support,
ticket-rules, portal-links, portal-access, analytics, metrics, health,
automation, cron-auth. See `docs/SAAS-MANAGEMENT-ARCHITECTURE.md`.

## 7–8. Organizations & Properties

- `Organization` is the tenant hub (`claimantKey` sha256 dedup for claimed
  orgs; health/mrr/arr signals; acquisition sourcing; affiliate/partner/
  franchise links).
- `Property` links org → Google `placeId` (unique) → external `pmsInstanceUrl`.
- `PropertyClaim` is the self-serve claim-with-verification path.

## 9. Users / RBAC

- Merge layer in `lib/rbac.ts`: `super_admin`, `subadmin`, `staff`,
  `affiliate`, `partner`, `customer`.
- SaaS permissions (29) + 17 roles in `lib/saas/roles.ts`.
- **No `User`/`Role`/`Permission`/`Membership` tables** — users referenced by
  email/id; roles resolved in code. Portal identity requires explicit binding.
- See `docs/SAAS-RBAC-MATRIX.md`.

## 10–11. Subscriptions & Billing

- `Subscription` state machine; `Invoice` with idempotency; `Payment` ledger.
- `lib/saas/{subscriptions,billing,invoices}.ts`.
- See `docs/SAAS-FINANCIAL-INVARIANTS.md`.

## 12. Payments

- Provider-neutral `lib/saas/payments/**` + `lib/saas/adapters/*`
  (13 wired: stripe, razorpay, paypal, adyen, cashfree, payu, checkout.com,
  square, mollie, phonepe, paytm, easebuzz + generic).
- **Wired ≠ LIVE.** Live requires `confirmLiveActivation`.
- See `docs/SAAS-INTEGRATIONS.md`, `docs/PAYMENT_PROVIDERS.md`.

## 13. Financial invariants

Idempotent ledger, explicit transitions, concurrency, currency minor units,
immutable audit, four-eyes approvals. See `docs/SAAS-FINANCIAL-INVARIANTS.md`.

## 14. Affiliates

- Full persistent attribution chain (15 affiliate models): clicks, campaigns,
  commissions, payouts, attribution, recruitment, tiers, fraud, agreements.
- Multi-tier + recurring + deferred commissions with fraud controls.
- Cron: `/api/saas/cron/affiliate-recurring`; payout settle via
  `/api/saas/payouts/settle`.

## 15. Partners

- `Partner` (reseller/consultant, commission model), portal `/partner`,
  `/api/partner/*`, merged into `lib/saas/partners.ts`.

## 16. Franchise

- `Franchisee`, `FranchiseTerritory` (tree), `FranchisePayout` (revenue-share),
  `lib/saas/franchise.ts`, `franchisePayouts.ts`, `/api/saas/franchise/**`.

## 17. Analytics

- `lib/saas/analytics.ts` (MRR/ARR, churn), `metrics.ts`, `health.ts` (org
  health score); `/api/saas/analytics`, `/api/saas/metrics`.

## 18. Settings

- `lib/saas/settings.ts`; `/api/saas/**` settings routes; `SystemSetting` KV
  store hosts provider configs + financial controls + portal bindings.

## 19. Integrations

- Google Places (**LIVE**), OTA reviews (**DEMO**), payment adapters (**WIRED**).
- `FeatureFlag` gates; `/api/saas/cron/automation`. See `docs/SAAS-INTEGRATIONS.md`.

## 20. Database

- 46 models, SQLite provider, no enums (controlled vocabularies as `String`).
- Versioned migrations in `prisma/migrations/`; `prisma migrate deploy` only.

## 21. API

- 154 route handler files; `/api/saas/**` is the largest surface (88 files);
  then `/api/marketing/**` (22), `/api/customer/**` (15), `/api/auth`,
  `/api/account`, `/api/affiliate`, `/api/partner`, `/api/properties`,
  `/api/leads`, `/api/saved`, `/api/search`, `/api/pricing`,
  `/api/payments/webhook/[provider]`, `/api/portals/onboarding`, and
  `/api/health`/`/api/settings`/`/api/reply`/`/api/report`.

## 22. Security

- Server-side authorization chain; UI hiding is not a boundary.
- Portal identities require explicit binding (never raw email).
- Secrets never committed; encrypted provider credentials; webhook signature
  verification. See `CONTRIBUTING.md`.

## 23. Tenant isolation

- Platform → Organization → Property → Users/Business Data.
- Requests must not escape org/property context; portal access guards in
  `lib/saas/portalAccess.ts`.

## 24. UI architecture

- App Router Server/Client components; marketing design system
  (`components/marketing/**`); SaaS admin (`app/saas/**`); portals
  (`/partner`, `/affiliate`, `/customer`, `/staff`, `/subadmin`).

## 25. Responsive / PWA

- Fully responsive; mobile shell verified at 360px with no horizontal
  overflow. PWA groundwork present (service-worker registration).

## 26. Runtime safety

- RSC/hydration: server-safe components, SSR `dark` class + client
  `ThemeInit` (light-mode users get a post-hydration theme switch — cosmetic).
- Production fixes: `fix-prisma-runtime.mjs` required on hPanel.

## 27. Testing

- Vitest unit tests colocated in `lib/**`; `tsc`, `eslint`, `build`,
  `launch:check`, `smoke`. Add focused tests for financial/security/tenancy.

## 28. Deployment

- GitHub → Hostinger. See `docs/DEPLOYMENT.md` and
  `docs/HOSTINGER-DEPLOYMENT-CONTRACT.md`.

## 29. Technical debt / risks (by severity)

**P1**
- No dedicated `User`/`Role`/`Permission`/`Membership` tables (largely
  code-resolved) — revisit as scale grows.
- Persistence single-provider (SQLite) — production-grade DB migration and
  review of `prisma db push` prohibitions/wrappers.
- Provider readiness coverage is uneven (many adapters wired but not verified
  live) — require per-provider sandbox connection tests before claiming Ready.

**P2**
- Leads/demos/pipeline in a marketing DataFile rather than schema tables —
  acceptable now, revisit for production CRM volume and historical retention.
- `/customer` "getting-started" and anchor consistency across pages — verify
  as routes evolve.
- SSR `dark`-class + client theme-switch flash (cosmetic).

**P3**
- Many legacy marketing roles retained for backward compat — consolidate over
  time.
- Various docs duplicates (`docs/` has overlapping launch/readiness files) —
  consider a documentation index.

## 30. Recommended engineering roadmap

1. **DB foundation**: adopt a production relational provider + continue
   versioned migrations; formalize User/Role/Membership models.
2. **Provider readiness program**: sandbox connection tests per payment
   provider; keep LIVE designation strictly evidence-based.
3. **Financial hardening audit**: dedicated tests around idempotency,
   concurrency (Plan.version), proration, dunning, coupon renewal.
4. **Tenancy isolation tests**: security tests proving org/property boundary
   cannot be escaped; audit portal-binding (never raw email).
5. **Growth data model**: promote leads/demos/pipeline into schema when volume
   demands.
6. **RBAC consolidation**: retire legacy marketing roles; single matrix
   (`docs/SAAS-RBAC-MATRIX.md`).
7. **Observability/deployment**: formalize smoke/launch checks in CI; keep
   deployment contract host-verified.

---

*This audit reflects the repository as inspected. Items not provable are marked
NOT VERIFIED and must not be treated as fact.*
