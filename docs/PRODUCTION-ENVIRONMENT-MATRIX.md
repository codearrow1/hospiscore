# PRODUCTION ENVIRONMENT MATRIX — HospiOS SaaS Management App

**Branch:** `release/financial-hardening-2026-08-24` · **Release SHA:** `9eefac5`
**Status:** repository-side authoritative reference. Live values are set on the Hostinger/hPanel host
at deploy time and are **never** stored in git. Nothing here prints or contains real secrets — only
formats, safe examples, and failure behavior.

Source of truth: `lib/config.ts` (runtime), `.env.example` / `.env.production` (repo templates),
`prisma.config.ts` (datasource), cron route files (`app/api/*/cron/*`), `lib/mailer.ts` (SMTP).

Legend — Production Required: **MUST** (app cannot run correctly without) · **HARD** (strongly
recommended, security/operational) · **OPT** (optional/feature) · **NO** (should be off/unset in prod).

---
## Critical (MUST / HARD)

| Variable | Purpose | Req | Used by | Secret | Expected format / Safe example | Failure behavior |
|----------|---------|-----|---------|--------|-------------------------------|------------------|
| `DATABASE_URL` | Prisma connection string for the SaaS plane (SQLite). | MUST | `prisma.config.ts`, `lib/prisma`, `lib/saas` | No (path) | Durable file path **without spaces**: `file:/home/u/saas-data/saas.db` or `file:./var/saas.db`. **NOT** `file:C:/Temp/saas.db`. | App cannot start (`start` runs `prisma migrate deploy` + Next); SaaS plane dead. |
| `PAYMENT_ENC_KEY` | Opaque value deriving the AES-256-GCM key that encrypts payment-provider secrets at rest. | MUST (prod) | `lib/saas/payments` (store/encryption) | **Yes** | Output of `openssl rand -hex 64` (128 hex chars). Set once; **do not rotate** after provider secrets are saved. | Unset ⇒ secrets not high-assurance encrypted; rotation ⇒ existing stored secrets fail to decrypt. |
| `CRON_SECRET` | Shared secret guarding SaaS cron endpoints (`X-Cron-Secret` header). | HARD | `app/api/saas/cron/{dunning,automation,lifecycle,usage}`, `app/api/marketing/cron/followups` | **Yes** | Long random string (≥32 chars). | Unset ⇒ cron endpoints rely on session auth (401 for anonymous scheduler ⇒ scheduled jobs never run). |
| `AFFILIATE_CRON_KEY` | Secret for the affiliate recurring-commission cron (`X-Api-Key` header). | HARD | `app/api/saas/cron/affiliate-recurring` | **Yes** | Long random string. | Unset ⇒ 401 ⇒ deferred commissions never advance. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for SEO (OG/sitemap/robots/canonical). Build-time inlined. | HARD | `app/layout.tsx`, SEO routes | No | `https://thebuddharice.online` | Warning; falls back internally; rejects non-HTTPS/localhost. |
| `SITE_URL` | Legacy canonical origin override; used for affiliate referral links. | HARD | `lib` (referral links), SEO | No | `https://thebuddharice.online` | Affiliate links may build wrong/host-relative URLs. |
| `ALLOW_DEMO_SEED` | Demo/admin account seeding flag. | MUST be `0` | `lib/marketing/seed.ts` | No | `0` (unset) | `1` ⇒ seeds `superadmin@hospios.demo` etc. into prod — launch-check HARD fails. |

## SMTP (transactional e-mail) — HARD
| Variable | Purpose | Req | Used by | Secret | Expected format | Failure behavior |
|----------|---------|-----|---------|--------|-----------------|------------------|
| `SMTP_HOST` | Outbound mail server host. | HARD | `lib/mailer.ts` (`CONFIG.smtpEnabled`) | No | e.g. `smtp.example.com` | Unset ⇒ no SMTP transport; mail falls to webhook/console. |
| `SMTP_PORT` | SMTP port (465=secure). | OPT | `lib/mailer.ts` | No | `587` or `465` | Defaults `587`. |
| `SMTP_USER` | SMTP auth user (required for transport). | HARD | `lib/mailer.ts` | Partially | e.g. `no-reply@thebuddharice.online` | Unset ⇒ `smtpEnabled=false` ⇒ no SMTP. |
| `SMTP_PASS` | SMTP auth password. | HARD | `lib/mailer.ts` | **Yes** | — | Unset ⇒ transport created without auth (will fail at send). |
| `SMTP_FROM` | From address. | OPT | `lib/mailer.ts` | No | `noreply@thebuddharice.online` | Defaults to `noreply@thebuddharice.online`. |

## Payment provider credentials — HARD (Phase 8)
Stored **encrypted at rest** in **Settings → Payments** (never read from env). Provider catalog:
Stripe, Razorpay, PayPal, Adyen, Cashfree, PayU, Checkout.com, Square, Mollie, PhonePe, Paytm, Easebuzz
(wired); Braintree, Authorize.net, Worldpay, CCAvenue, Coinbase (not wired).
| Variable | Purpose | Req | Used by | Secret |
|----------|---------|-----|---------|--------|
| (per provider) secret/publishable key, webhook secret, extra fields | Live gateway credentials + webhook signing secrets. | HARD when a provider is enabled | `lib/saas/payments/adapters/*`, `store.ts`, `reconcile.ts` | **Yes** — encrypted; masked on read. |

## External data / AI / review providers — OPT
| Variable | Purpose | Req | Used by | Secret | Failure behavior |
|----------|---------|-----|---------|--------|------------------|
| `GOOGLE_PLACES_API_KEY` | Server-side Places lookup — switches app to **live** data mode. | OPT (live mode) | `lib/providers/google.ts`, `CONFIG.googlePlacesApiKey` | **Yes** | Unset ⇒ demo mode (honest badges; default for safe launch). |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser Maps autocomplete. | OPT | client | Partially (public) | Unset ⇒ text-box search fallback. |
| `REVIEW_PROVIDER` | `demo` / `stayapi` / `apify` OTA review source. | OPT | `lib/providers/reviews.ts` | No | Defaults `demo` (safe). |
| `REVIEW_API_KEY` / `REVIEW_BASE_URL` | Review provider credentials. | OPT | `lib/providers/reviews.ts` | **Yes** | Unset ⇒ demo reviews. |
| `DEEPSEEK_API_KEY` | AI review reply drafts. | OPT | AI draft feature | **Yes** | Unset ⇒ deterministic template fallback. |
| `APIFY_DATASET_ID` / `APIFY_BASE_URL` | Apify review-text ingest. | OPT | review ingest | Partially | Unset ⇒ feature off. |

## Data / cache / misc — OPT
| Variable | Purpose | Req | Secret | Failure behavior |
|----------|---------|-----|--------|------------------|
| `APP_DATA_FILE` | JSON data file (accounts/sessions/leads/scores). | OPT | No | Default `<project>/var/data.json`. |
| `APP_DATA_MIRROR` | Secondary JSON copy (survives deploys). | OPT | No | Default `~/.hospiscore/data.json`. Used for demo-only PBKDF2 encryption fallback when `PAYMENT_ENC_KEY` unset. |
| `APP_SESSION_COOKIE` / `APP_SESSION_DAYS` | Session cookie name/lifetime. | OPT | No | Defaults `hs_session` / 30. |
| `ADMIN_EMAILS` | Comma-separated emails allowed into `/account/leads`. | OPT | No | Unset ⇒ admin leads view closed (capture still works). |
| `SALES_EMAIL` | Sales contact + lead notification receiver. | OPT | No | Default `hello@hospios.app`. |
| `ALERT_WEBHOOK_URL` | JSON mail relay (Resend/Mailgun style) used when SMTP unset. | OPT | Partially | Unset ⇒ console. |
| `DATA_PROVIDER` / `SQLITE_FILE` | Legacy JSON-backend provider (not the SaaS plane). | NO (prod) | No | Remain `file` default; not used for the SaaS DB. |
| `CACHE_PROVIDER` / `REDIS_URL` / `CACHE_DISABLED` | Cache (memory default). | OPT | No | Unset ⇒ memory. `CACHE_PROVIDER=redis` needs `REDIS_URL`. |
| `PRISMA_QUERY_ENGINE_LIBRARY` | Engine override for hosts lacking `lib/generated` (hPanel fallback). | OPT | No | Only if hPanel needs it. |
| `TRACK_VIEWS`, `PUBLIC_RATE_*`, `ADMIN_RATE_MAX` | Analytics + rate limits. | OPT | No | Defaults safe. |
| `DEMO_MEETING_URL` | Demo meeting link base. | OPT | No | Default `https://meet.hospios.app/`. |

---
## Verification
`npm run launch:check` reports each as PASS / FAIL / WARN / NOT VERIFIED. In this (repo) environment
all production secrets are correctly **unset/NOT VERIFIED** — a non-failure state, because live values
are only owned by the deployment owner at hPanel. NEVER print value contents; only PRESENT / MISSING /
INVALID / NOT CONFIGURED.
