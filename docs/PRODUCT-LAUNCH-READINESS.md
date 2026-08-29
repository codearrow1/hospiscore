# PRODUCT-LAUNCH-READINESS — HospiOS SaaS Management App (Phase 48)

**Branch:** `release/financial-hardening-2026-08-24` (HEAD `00b0deb` + Phase 3 working tree)
**Date:** 2026-08-29

---

## 1. Executive summary

HospiOS, in its **actual implemented form**, is a complete **SaaS management platform** for
hotel/property owners: a public marketing site, a free online-presence reputation score tool
(property discovery, scoring, review ingestion, Google-listing claim & verification), and a full
SaaS command plane (organizations, properties, subscriptions, invoicing/payments, affiliate /
partner / franchise programs, support, RBAC, audit, and a lead-gen CRM).

Phase 3 re-scoped from "build a hotel PMS" to **"make the real SaaS product launch-ready,"** per
the product owner. That product is verified working end-to-end with a green gate suite, one P0
(auth-entry dead redirect) and one P1 (missing public health probe) fixed this phase, and a
smoke test added.

**Launch decision: CONDITIONAL ONLY READY. The repository code is ready and all gates pass; the
only non-code requirements are live-host provisioning (SMTP, payment-provider credentials,
`PAYMENT_ENC_KEY`, Google Places key, durable `DATABASE_URL`) and a maintained dependency-audit
decision.**

---

## 2. Architecture

- **Framework:** Next.js 15.5.21 (App Router, React 19), TypeScript 5.9, Tailwind 4.
- **Data:** two stores — a **Prisma/SQLite** plane for SaaS commerce (orgs, properties/claims,
  plans, subscriptions, invoices, payments, audit, support, affiliates/partners/franchise) and a
  **JSON-file store** (`var/data.json`) for accounts/sessions and the marketing lead-CRM. Prisma
  `prisma-client` generator (cjs), 22 migrations (incl. payment-persistence reconciliation).
- **Auth:** scrypt hashing; bearer session token in httpOnly/sameSite/lax/secure cookie;
  SHA-256-at-rest token; ORM/CSRF middleware + per-route `originAllowed` + in-memory rate limits.
- **Payments:** provider-abstracted gateway (Stripe/Adyen/PayU + catalog), hosted checkout +
  **webhook-authoritative** reconciliation, transactional overpay caps, four-eyes refunds.
- **Deploy target:** Hostinger/hPanel (`thebuddharice.online`); repo-side env in `docs/`.

---

## 3. Product modules (what actually ships)

1. Public website & blog/knowledge/FAQ/pricing/solutions.
2. Free online-presence score (demo + live Google/review modes via `lib/config.ts` dataMode).
3. Google-listing discovery, claim, and ownership verification.
4. Organizations & properties (scoring records, `placeId`-linked).
5. Subscriptions, plans + country pricing, plan-change approvals.
6. SaaS billing: invoices, payments, refunds (four-eyes), dunning, coupons, usage entitlements.
7. Customer self-service portal (dashboard, plan-change requests, invoice PDF/print, pay-now,
   claim verification, onboarding checklist).
8. Platform control plane (Command Center KPIs, org 360, subscriptions, usage, feature flags).
9. Affiliate, partner, and franchise programs (commissions, payouts, fraud queue, approvals).
10. Support ticketing with SLA tracking (staff/support queue).
11. Lead-gen CRM: pipeline stages, campaigns, forms, analytics, CSV export, AI reply/report.
12. RBAC + immutable audit log + financial (four-eyes) approvals.

*The 23-module PMS catalogue in `lib/modules.ts` (rooms, reservations, POS, housekeeping, etc.) is
marketing copy only — out of scope for this product landing.*

---

## 4. Role matrix (real)

| Role (real) | Engine | Primary surface | Key perms |
|-------------|--------|-----------------|-----------|
| super_admin | App + SaaS + Marketing | Command Center, settings, team | all 28 |
| platform_admin | SaaS | Command Center | most |
| finance_admin | SaaS | billing, financial approvals | BILLING_*, REFUND_APPROVE |
| marketing_admin | SaaS + Marketing | campaigns, analytics | MARKETING_* |
| sales_admin / sales_rep | Marketing | leads, pipeline, export | leads.* (owner-scoped) |
| customer_success / support_admin | SaaS | support queue | SUPPORT_* |
| affiliate_manager / partner_manager / franchise_manager | SaaS | programs | AFFILIATE_*/PARTNER_*/FRANCHISE_* |
| analyst / read_only | SaaS | view-only | read perms |
| customer | App (portal) | customer self-service | own org only |
| affiliate / partner | App | portal | own program |

*The "10 PMS roles" (HOST_ADMIN, RECEPTIONIST, HOUSEKEEPING, etc.) from the generic prompt do not
exist in this product's RBAC — they are PMS-marketing terms, out of scope.*

---

## 5. Golden user journey (SaaS)

1. Owner signs up on `/account` (AuthCard).
2. SaaS admin creates an **Organization** and **onboards a Property** via Google import.
3. Owner **claims + verifies** the Google listing (ownership proof).
4. Admin picks a **Plan** (subscription) → plan-change/subscription applied.
5. SaaS **billing** issues an invoice; owner pays via hosted checkout → webhook settles (paid).
6. Admin sets up **team** (org contacts) and sees the **onboarding checklist** complete.
7. Admin operates the **Command Center** (real MRR/ARR/customers), org 360, usage.
8. Owner raises a **support ticket** → staff queue → resolve.
9. Optional **lead-CRM**: capture a lead → qualify → move stage → CSV export.
10. Same journey re-run in **failure mode**: bad login, denied cross-org access, overpay/dup
    payment, voided invoice, unverified claim, rate-limited public endpoint — each lands in a
    **safe state with a clear message and no corrupted records.**

---

## 6. Failure journey (verified safe)

| Failure | Safe outcome |
|---------|--------------|
| Wrong credentials / expired session | 400 / redirect to `/account?next=`; no auth bypass |
| Unauthorized role action | Guarded (403 or restricted panel); `hasSaasPerm`/`hasCapability` |
| Cross-org IDOR | `requireCustomerOrg` scope; rejected |
| Duplicate/overpay payment | In-transaction outstanding-cap rejects; no overpaid invoice |
| Duplicate webhook event | `@@unique([provider,eventId])` → replay-safe, idempotent |
| Voided-invoice payment | Rejected ("Cannot pay a voided invoice") |
| Unverified property claim | Approval gated on `verified` |
| Public reply/report abuse | `originAllowed` (403) + `rateLimit` (429) |
| Unconfigured payment env | `launch:check` HARD gates; provider-neutral at launch |
| Demo seeding in prod | `ALLOW_DEMO_SEED=0` + HARD check |

---

## 7. Security

- **Auth:** scrypt, SHA-256-at-rest tokens, httpOnly/secure/sameSite cookies, timing-safe compare.
- **RBAC / isolation:** 28-permission matrix; org/claim/property scoping on every query;
  `requireCustomerOrg` tenant guard; no cross-org exports.
- **CSRF:** global middleware on `/api/saas|logout|account|saved|settings` + per-route
  `originAllowed`. *(Known: `originAllowed` permits absent-Origin for non-browser clients — accepted.)*
- **Payments:** server-derived amounts; webhook-authoritative reconciliation; secrets AES-256-GCM
  masked on all read paths; no secrets in logs.
- **Audit:** append-only, immutable financial audit + four-eyes approvals.
- **SSRF/origin/rate limiting** on all public POST endpoints (reply/report/forms).
- **Open redirect:** payment `returnUrl` sanitized via `safeNext` (O-19, Phase 48).

## 8. Data integrity / concurrency / idempotency

- Transactional overpay cap + settle-in-same-tx (`gateway.ts`); `$transaction` w/ timeout on
  renewals, usage billing, refunds.
- Unique idempotency keys: `PaymentIntent.idempotencyKey/providerRef`, `Payment.providerPaymentId`,
  `PaymentWebhookLog(provider,eventId)`, org `claimantKey`, coupon-redemption, attribution.
- Webhook replay-safe; intent reuse for open invoices.
- **Known gap (B-3, accepted):** `createInvoice`/`recordPayment` accept but don't enforce a
  caller `idempotencyKey` column — invoice dedup absent, though duplicate payment is prevented by
  the transactional cap. Deferred (schema change) with mitigation documented in `LAUNCH-BLOCKERS.md`.

## 9. Mobile / a11y / dark mode

- Critical SaaS workflows (auth, onboarding, billing, support, leads, dashboards) are responsive;
  portal bottom-nav + responsive shell; verified at mobile→desktop breakpoints in component tests.
- A11y: labeled controls, dialogs, keyboard nav in shell; known P2/P3 contrast/keyboard items
  tracked in `LAUNCH_READINESS_ISSUES.md` (O-33..O-37); no P0/P1 a11y issues blocking launch.
- Dark mode: full dark palette throughout (`dark:` variants); major dashboards render in
  light/dark/system.

## 10. Performance

- SSG/static marketing routes; dynamic SaaS/customer routes are `force-dynamic` (correct for
  per-user data). No N+1 known blockers on critical paths; analytics/metrics compute single-pass
  aggregates. Shared JS ~102 kB first load. No known launch-blocking performance issue.

## 11. Observability

- **New public `GET /api/health`** liveness/readiness (added Phase 3; DB reachability + 503).
- Auth-protected diagnostics: `/api/saas/admin/control-plane-diagnostics`, `db-diag`.
- Root + per-plane error boundaries that surface Next `error.digest`.
- **Known gap (B-5):** no request-ID middleware or structured logger — accepted; `error.digest` +
  business-object IDs provide traceability.

## 12. Backup / recovery

- `docs/PRODUCTION_DATABASE_BACKUP.md` — nightly SQLite `.backup`, JSON-data copy,
  `PAYMENT_ENC_KEY` offline storage, restore + verification steps.
- `docs/PRODUCTION_RUNBOOK.md` — ops runbook, escalation, incident response (payment/auth).
- `docs/PRODUCTION_ENVIRONMENT.md`, `DEPLOY-SAAS.md`, `PAYMENT_WEBHOOKS.md`, `PAYMENT_PROVIDERS.md`.

## 13. Launch blockers

See `docs/LAUNCH-BLOCKERS.md`. Summary: **P0 = 0** after the Phase-3 auth-entry fix; **P1 = 2
observability/settings items** (health fixed; B-4/B-5 accepted-with-mitigation); **P2 = dependency
audit (not force-fixed), free-score demo values, origin-less CSRF posture; P3 = post-launch.**

## 14. Test results (2026-08-29)

- `npm run typecheck` — **PASS**
- `npm run lint` — **PASS**
- `npm test -- --no-file-parallelism` — **PASS 615/615** (51 files; incl. new health-route test)
- `npm run build` — **PASS**
- `npm run smoke` — **PASS 14/14**
- `npm run launch:check` — **PASS (FAIL 0)**
- `npm audit` — 6 high (**transitive** build-tooling: `deepmerge-ts`/`postcss`/`sharp` via prisma CLI + next); force-fix = breaking upgrades, deferred (B-6)
- `git diff --check` — PASS

---

## 15. Product score (SaaS management app; 0–100)

| Area | Score | Basis |
|------|-------|-------|
| Website | 95 | Complete, static, responsive, SEO-ready |
| Auth | 85 | Solid scrypt/session; password-reset email is host-dependent; P0 dead-login fixed |
| Onboarding (org/property) | 80 | Real checklist + Google import; manual support step by design |
| Property / claims / score | 85 | Full claim + verification + scoring pipelines |
| Subscriptions / plans | 85 | Self-service requests + admin apply, entitlements, approvals |
| Billing / payments | 88 | Webhook-authoritative, race-safe; B-3 idempotency gap accepted |
| Customer portal | 80 | Billing, plan changes, invoice PDF/print, onboarding |
| Support | 85 | Full lifecycle + SLA + staff queue |
| Affiliate/Partner/Franchise | 75 | Programs, payouts, fraud; notification gaps (O-26) |
| Lead-gen CRM | 85 | Pipeline, campaigns, forms, analytics, scoped export |
| Reports / analytics | 85 | Real DB aggregates; no fabricated KPIs in dashboards |
| Team / RBAC / audit | 90 | 28-perm matrix, immutable audit, four-eyes |
| Security | 85 | Strong auth/CSRF/IDOR/payment; B-8 accepted |
| Mobile | 80 | Responsive critical workflows; no desktop-only blocker |
| Accessibility | 75 | No P0/P1; O-33..O-37 P2/P3 tracked |
| Performance | 85 | No known blocker; dynamic routes correct |
| Observability | 70 | Health now present; B-5 structured logging deferred |
| **OVERALL PRODUCT READINESS** | **84** | Ready with host provisioning + accepted P1/P2 mitigations |

*(PMS-specific rows — reservations/front desk/restaurant/housekeeping/maintenance/guest services —
are **N/A / out of scope** for this product per the owner; scored 0 and excluded from OVERALL.)*

---

## 16. Business acceptance

| Workflow | Can a real customer use it without developer help? |
|----------|---------------|
| Sign up / log in / reset password | **YES** (reset email needs SMTP at host) |
| Create organization, onboard + claim property | **YES** (Google import + verification) |
| Pick a plan, get subscribed, see onboarding checklist | **YES** |
| Get billed, pay invoice online, download invoice | **YES** (payment-provider creds at host) |
| Self-service plan change / cancellation request | **YES** (reviewed & applied by billing team) |
| Run day-to-day platform ops (Command Center, org 360, support) | **YES** |
| Run lead-gen CRM + export leads | **YES** |
| Operate a hotel front desk / rooms / folios | **NO — out of scope** (PMS not built; marketing-only) |

---

## 17. Final launch decision

```
LAUNCH STATUS: CONDITIONAL (repo-ready; host provisioning required)
```

**MUST FIX BEFORE LAUNCH (repo):** none remaining (P0 = 0).
**MUST PROVISION BEFORE LAUNCH (host):**
- SMTP (`SMTP_HOST/USER/PASS/FROM`) for password-reset, dunning, notifications and support email.
- Payment-provider credentials (set provider to `verify`/`ready`) + `PAYMENT_ENC_KEY`.
- `GOOGLE_PLACES_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to leave demo data mode.
- Durable `DATABASE_URL` (currently temp `file:C:/Temp/saas.db`).
- Confirm `NEXT_PUBLIC_SITE_URL` / `SITE_URL`, `CRON_SECRET`, `AFFILIATE_CRON_KEY`.

**EXPLICITLY ACCEPTED WITH MITIGATION (P1/P2):**
- B-3 invoice idempotency-key not enforced (transactional cap mitigates; schema change deferred).
- B-4 SMTP/integration settings persisted-but-decoupled from env (set env, don't rely on UI).
- B-5 no structured logger/request-IDs (error.digest + boundary surfaces).
- B-6 npm audit 6 high — transitive build-tooling; no force (breaking) upgrade pre-launch.
- B-8 `originAllowed` permits absent-Origin (non-browser) — accepted design.

**CAN WAIT UNTIL POST-LAUNCH (P3):**
- Structured logging / request correlation.
- Full `idempotencyKey` enforcement on invoice/payment.
- Score history to DB model; notification wiring; legacy vs new lead-store consolidation.
- A11y contrast/keyboard P2/P3 items; marketing hardcoded-storefront numbers (by design).

**BUSINESS DECISIONS REQUIRED:**
- Accept the P1/P2 mitigations above, or schedule the gateway idempotency schema change.
- Dependency-audit policy: when to schedule `next@16` / prisma upgrade (breaking).
- Whether `thebuddharice.online` (default canonical origin) is the correct public brand/origin.

**INFRASTRUCTURE REQUIRED (host):**
- Hostinger/hPanel runtime: SMTP, DB path, payment + Google + encryption keys, cron secrets,
  monitoring of `/api/health`, backup/restore execution (`docs/PRODUCTION_*`).

---

*Deliverables this phase: `docs/LAUNCH-BLOCKERS.md`, `docs/LAUNCH_ACCEPTANCE_MATRIX.md`,
`docs/PRODUCT-LAUNCH-READINESS.md` (this file), `app/api/health/route.ts`,
`scripts/smoke.ts` + `npm run smoke`, and the Phase-3 P0/P1 code fixes (dead-login redirects,
health endpoint). No push/deploy/ruleset changes performed.*
