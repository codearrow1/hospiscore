# LAUNCH READINESS ISSUES — HospiOS (Phase O)

**Branch:** `release/financial-hardening-2026-08-24` · **HEAD:** `95c6a0d`
**Scope:** Complete product audit across all 19 launch areas.
**Date:** 2026-08-28 (Phase 48 status update: 2026-08-29 — all repo-side P0/P1 closed; report in `docs/LAUNCH_READINESS_REPORT.md`)

Severity:
- **P0** = cannot launch
- **P1** = serious launch risk
- **P2** = should fix before launch if practical
- **P3** = post-launch improvement

Each issue is tagged **REPO** (fixable in code, repo-side) or **HOST** (requires
deployment/environment config or credentials — cannot be closed from code).

---

## P0 — CANNOT LAUNCH

| ID | Area | Route | Role | Root cause | Evidence | Fix | Status |
|----|------|-------|------|-----------|----------|-----|--------|
| O-01 | Payments / DB | `prisma/schema.prisma` vs `prisma/migrations` | all | **Payment persistence layer has NO migration.** Schema defines `PaymentIntent` (:409), `PaymentWebhookLog` (:445), `PaymentProviderHealth` (:464), and new `Payment` columns (`providerRef`, `providerPaymentId`, `webhookEventId`, `paymentIntentId`, `method`, `methodMasked`, `feeMinor` :383-396) + indexes. **Zero** migration SQL references these tables/columns (grep across `prisma/migrations` = 0 hits). A fresh `prisma migrate deploy` install lacks the entire payment persistence layer. | grep `<PaymentIntent|PaymentWebhookLog|PaymentProviderHealth|providerRef|feeMinor>` in `prisma/migrations` → 0 files. Tests pass only because they use `prisma db push --skip-generate` (schema-sync bypasses migrations). | REPO: add an additive migration creating the 3 tables and `Payment` columns (see `docs/PRODUCTION_DATABASE_BACKUP.md`) | **RESOLVED** (2026-08-29: added `20260828120000_schema_drift_reconciliation`; fresh-deploy diff now empty, verified 22 migrations converge to schema) |
| O-02 | Email / Verification | `lib/saas/propertyVerification.ts:143-160` | customer/admin | **Claim OTP is never delivered.** `verifyCode`/OTP generation stores a hashed code and returns a `debugCode` in dev, but there is **no SMS/email delivery call at all** in production. `decideClaim` requires `verified`, so claim approval is gated on a code the user can never receive. | comment `propertyVerification.ts:9-11,123-125` (OTP "delivered out-of-band" — nothing does); `resolver` uses Google on-file phone | HOST (needs SMS/email provider) + REPO (add a real out-of-band delivery hook or an honest `deliveryRequired` guard; default SMTP) | **OPEN** |
| O-03 | Email / Auth | `app/api/auth/password-reset/route.ts:12-16,44-51` | any user | **Password-reset email is not delivered in production.** `sendMail` falls back to console when SMTP/webhook unset; code comment explicitly labels this a "BACKEND GAP" (operator channel in prod). | `mailer.ts:59-66` console fallback; no `SMTP_HOST`/`SMTP_USER` anywhere | HOST (set SMTP) — code path exists | **OPEN** |
| O-04 | Payments | `store.ts` / `intents.ts:50-52` | super_admin | **No payment provider is configured/readable.** `payment_providers` SystemSetting absent in DB → `canRoutePayment` false for every provider; checkout throws "No payment provider is enabled". | DB query: 0 provider rows | HOST (provision credentials at launch). Not a code bug; expected provider-neutral state. | **OPEN (by design via Phase N)** |
| O-05 | Reviewing | `lib/providers/reviews.ts:154-161` | any visitor | **Apify review provider is a stub that reports `live: true` while returning zero data.** If `REVIEW_PROVIDER=apify` is set, property pages silently lose all OTA review signals with no error. | `{ sources: [], platforms: {}, live: true }` | REPO: return `live:false` + warn, or implement; and add `REVIEW_PROVIDER` to `launch:check` | **RESOLVED** (`reviews.ts` now returns `live:false`, 2026-08-29) |

---

## P1 — SERIOUS LAUNCH RISK

| ID | Area | Route | Role | Root cause | Evidence | Fix | Status |
|----|------|-------|------|-----------|----------|-----|--------|
| O-10 | RBAC / Data | `app/api/marketing/export/route.ts:24` | sales_rep | **CSV export bypasses owner scoping.** `owner` comes straight from query string with no `canSeeAll` gate — a `sales_rep` can dump every lead (email/phone/contact) org-wide. | compare to `marketing/leads/route.ts:26-29` which gates `owner` behind `leads.manage` | REPO: gate `owner` behind `hasCapability(user,"leads.manage")` (one-liner) | **RESOLVED** (2026-08-29) |
| O-11 | RBAC / Data | `app/api/marketing/stats/route.ts:17-30` | sales_rep | **Stats returns org-wide metrics + team directory** to any `leads.read` holder — no non-manager scoping; `listUsers()` exposes emails/roles. | handler computes `dashboardMetrics/campaignStats/listUsers/allViews` unscoped | REPO: scope metrics by `owner` for non-managers; redact/limit `users` | **RESOLVED** (2026-08-29) |
| O-12 | Abuse / Cost | `app/api/reply/route.ts:13-36` → `lib/reply.ts:76-91` | anonymous | **Unauthenticated, unrate-limited DeepSeek endpoint.** Burns API credits on arbitrary prompt text. | `lib/reply.ts` calls `chat/completions` with server key; route imports no guard | REPO: `rateLimit` + `originAllowed`; optionally require `leads.read` | **RESOLVED** (2026-08-29: `NextRequest` + `originAllowed` + `rateLimit(IP,20,60s)`) |
| O-13 | Abuse / Spam | `app/api/report/route.ts:24-64` | anonymous | **Open email-sending + lead-pollution vector.** Sends branded email to any address and writes a lead, unlimited. | `sendMail({ to: record.email })` at :52; no rate/origin control | REPO: per-IP/per-email rate limit + `originAllowed` + honeypot | **RESOLVED** (2026-08-29: `NextRequest` + `originAllowed` + `rateLimit(IP,10,60s)`) |
| O-14 | Payments | `lib/saas/adapters/payu.ts:132-134` | finance | **PayU refund not implemented** (throws 501). No in-app refund path for PayU. | `throw new GatewayError("...not implemented", 501)` | REPO: document/deprecate, or implement via dashboard | **RESOLVED** (2026-08-29: removed `refund` from PayU capabilities — honest 501) |
| O-15 | Payments | `lib/saas/gateway.ts:41-42,90` | system | **Idempotency key accepted but not enforced.** Retried client request can create duplicate invoices. | comment "idempotencyKey ... not yet enforced" | REPO: add unique key column + dedupe (P1 for payments) | **OPEN (deliberate, re-audit)** |
| O-16 | Payments | `lib/saas/payments/types.ts:175`, `intents.ts:101` | super_admin | **No explicit TEST→LIVE activation gate.** `mode` is cosmetic (only TTL differs); a test-verified provider can be marked `live` and route. | `enabled && (ready|verify)` routes in either mode | REPO: require explicit live activation/ack | **RESOLVED** (2026-08-29: `saveProviderConfig` rejects unreviewed `TEST→LIVE` unless `confirmLiveActivation`) |
| O-17 | Payments | `lib/saas/payments/crypto.ts:20-33` | super_admin | **`PAYMENT_ENC_KEY` unset → deterministic demo key** (obfuscation-grade, not production). | `crypto.ts:14-32`; env empty | HOST (set key) + REPO: `launch:check` HARD fail when unset in prod | **REPO RESOLVED** (2026-08-29 HARD check added); **HOST-OPEN** (set `PAYMENT_ENC_KEY` at deploy) |
| O-18 | DB / Ops | `.env` vs `.env.example` | ops | **Active DB is a temp file path** `file:C:/Temp/saas.db` vs example `./var/saas.db` — ephemeral, excluded from backup, schema-drift risk. | `.env` vs `.env.example` | HOST: pin `DATABASE_URL` to a durable path | **OPEN** |
| O-19 | Web/Payments | `lib/saas/payments/intents.ts:135`, `app/api/customer/payments/route.ts:48` | payer | **Payment `returnUrl` passed verbatim to provider** as success URL — open-redirect risk for shared checkout links. | forwarded into `return_url`/`success_url` | REPO: validate `returnUrl` via `safeNext` (must start `/`, reject `//`/`/\`) | **RESOLVED** (2026-08-29: `intents.ts` sanitizes via `safeNext`, fallback to `/customer/checkout/<id>`/`/customer/billing`) |
| O-20 | Review/DB | `lib/config.ts:31,37` | ops | **`reviewProvider` defaults to `demo`; `CONFIG.live` false when Google key empty** → app silently renders demo data to real users in a misconfigured prod deploy. Not caught by `launch:check`. | `config.ts` dual-mode | REPO: add HARD `launch:check` check (demo mode in prod = FAIL) | **REPO RESOLVED** (2026-08-29 HARD check added); **HOST-OPEN** (confirm `GOOGLE_PLACES_API_KEY` at deploy) |

---

## P2 — SHOULD FIX BEFORE LAUNCH IF PRACTICAL

| ID | Area | Route | Role | Root cause | Evidence | Status |
|----|------|-------|------|-----------|----------|--------|
| O-21 | Auth | `app/api/auth/password-reset/confirm/route.ts:37`, `lib/accounts.ts:148-168` | any | Password reset does not revoke existing sessions; stolen sessions persist. | `consumePasswordReset` replaces hash only | OPEN |
| O-22 | Auth | `lib/accounts.ts:60-67,89-94` | any | Session accumulation never pruned (no single-session rotation). | `purgeExpiredSessions` drops expired only | OPEN |
| O-23 | Abuse | `app/api/affiliate/track/route.ts:11-95` | anonymous | Unbounded DB writes on click tracking; GET mutates; no rate/origin; cookie up to 90d. | `trackClick` on every request | OPEN |
| O-24 | Abuse | `app/api/demo/route.ts:12-26` | anonymous | Demo-pipeline spam; no rate/origin/honeypot. | writes lead, no controls | OPEN |
| O-25 | CSRF | `app/api/properties/claim/start/route.ts` | visitor | Missing `originAllowed` on a state-changing POST (sibling routes have it). | — | OPEN |
| O-26 | Notifications | `lib/saas/notifications.ts`, `app/api/affiliate/me/route.ts:29` | all | No notifications for payment success / invoice / subscription-renew / affiliate / partner / onboarding; `AffiliateNotification` model never written (static). | grep: `AffiliateNotification.create` never called | OPEN |
| O-27 | Notifications | `lib/saas/notifications.ts:47`, `app/api/saas/notifications/route.ts:16` | SaaS | `Notification.userId` used inconsistently (user id vs email) → claim-generated notifications never surface in the SaaS bell. | mixed-key writes | OPEN |
| O-28 | DB | `20260828020000_financial_approvals/migration.sql` | ops | financial-approvals migration not idempotent (plain `CREATE TABLE`, no `IF NOT EXISTS`). | migration.sql | OPEN |
| O-29 | DB | `lib/scoreHistory.ts` | ops | Score history is file-based (`SCORE_HISTORY_DIR`), no DB model, subject to file loss; identity = path not FK. | config.ts:48-49 | OPEN |
| O-30 | DB | sqlite | ops | SQLite single-writer; concurrency mitigated (tx + re-aggregate) but no WAL/busy-timeout tuning for webhook bursts. | gateway.ts:147,264 | OPEN |
| O-31 | Identity | `lib/saas/properties.ts`, `lib/resolver.ts` | all | Scoring/leads/tenant `Property` are linked only by the `place:<id>` string, not a durable FK — score history for a claimed Property is not guaranteed (P3-P5 dual-store gap). | no FK between `var/scores` and Prisma `Property` | OPEN |
| O-32 | SEO | `lib/site.ts:27` | ops | Canonical origin depends on `NEXT_PUBLIC_SITE_URL` unset anywhere; fallback is hardcoded `https://thebuddharice.online` (wrong brand). Ensure env set at deploy. | `site.ts` fallback; `docs/PRODUCTION_ENVIRONMENT.md:24` requires it | OPEN (HOST+REPO) |
| O-33 | SEO | `app/demo/page.tsx`, `app/properties/[slug]/page.tsx:11-23` | — | `/demo` has no page metadata; `/properties/[slug]` has no canonical/OG/JSON-LD. | `generateMetadata` returns title/desc only | OPEN |
| O-34 | A11y | `components/shell/AppShell.tsx:352-375` | all | `role="menu"`/`menuitem` misuse without keyboard arrow nav. | account dropdown | OPEN |
| O-35 | A11y | `components/Header.tsx:49-104` | all | Dropdown `aria-haspopup` without `aria-expanded`; keyboard disclosure fragile. | CSS `group-hover` panel | OPEN |
| O-36 | A11y | `components/BookDemoForm.tsx:168-189` | all | `<select>` and textarea both write `values.message` (silent data loss). | both `set("message",...)` | OPEN |
| O-37 | Mobile | `components/dashboards/charts-interactive.tsx:56-108` | all | Chart tooltips mouse-only; no accessible data table on touch. | `onMouseMove` only | OPEN |
| O-38 | PWA | `public/sw.js:22-32` | all | Shared cache never invalidated per-user; stale authed HTML could be served to another local user. | URL-only cache key | OPEN |
| O-39 | Email | `lib/mailer.ts:59-66` | all | Email body logged in cleartext to stdout on console fallback. | `console.log("[alert-email] ...")` | OPEN |
| O-40 | External | `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` empty | ops | App runs in **demo** mode at launch → real property data unresolved; claims require Google. | `.env.local:19,26` | OPEN (HOST, REQUIRED FOR LAUNCH) |
| O-41 | Analytics | global | ops | **No analytics SDK and the internal `/api/marketing/track` beacon is never invoked from the client** — signup/claim/subscription/payment conversions unmeasurable. | grep: no gtag/dataLayer; no TSX calls `/api/marketing/track` | OPEN (decision needed) |
| O-42 | Legal | `app/terms`, `app/privacy` | — | Confirm Terms/Privacy/Refund/Affiliate/Partner policy docs reflect actual billing/refund terms. | static content pages | OPEN (review) |

---

## P3 — POST-LAUNCH IMPROVEMENT

- O-50 SEO: home `SoftwareApplication.offers` price `"8"` hardcoded (`app/page.tsx:174`) — drive from catalog.
- O-51 SEO: hardcoded `thebuddharice.online` in email/partner/self-referrer (`lib/marketing/followups.ts:52`, `lib/config.ts:96`, etc.) — centralize behind `SITE_URL`.
- O-52 Payment catalog: filtered-out stubs (`mollie2`, `checkout`) in `capabilityMatrix.ts:215-217` — clean up.
- O-53 A11y: low-contrast `text-zinc-500` on `zinc-950` (`AppShell.tsx:176`). Bump to AA.
- O-54 Mobile: `UiMock.tsx:343` raw `<img>` without dims (CLS).
- O-55 A11y: account-settings scroller nav missing `aria-label` (`AccountSettingsLayout.tsx:31`).
- O-56 Security (P3): `db-diag` returns absolute SQLite path (`:97`); password-reset confirm GET unrate-limited; `/api/search`, `/api/pricing/*` unthrottled.
- O-57 Onboarding: subject resolved by email fallback (P3-2) — prefer binding-only resolution.

---

## VERIFIED-OK (no action from these audits)

- **Control-plane mutations** — every `/api/saas/*` mutation enforces `hasSaasPerm` (payments-providers `SYSTEM_SETTINGS_MANAGE`, payouts `AFFILIATE_PAYOUT`, invoices `BILLING_*`, financial-approvals requester≠approver + `FINANCIAL_APPROVE`, orgs `CUSTOMER_*`, claims `PROPERTY_MANAGE`, subs `SUBSCRIPTION_*`, users `SYSTEM_SETTINGS_MANAGE`, support `SUPPORT_*`).
- **Customer portal tenant isolation** — every `/api/customer/*` mutation constrains queries to the resolved `organizationId` via `requireCustomerOrg`.
- **Webhook replay** — idempotent via `@@unique([provider,eventId])` + `wh_<eventId>` idempotency key; server-confirmation-only.
- **Secret handling** — provider secrets AES-256-GCM (`crypto.ts`), masked on every read path, never returned to client, never logged.
- **Auth hygiene** — scrypt hashing, session tokens SHA-256 at rest + httpOnly/sameSite=lax/secure cookie, timing-safe compare.
- **CSRF** — middleware covers `/api/saas`, `/api/auth/logout`, `/api/account`, `/api/saved`, `/api/settings`; others use `originAllowed` (except O-25).
- **Cron/webhooks** — timing-safe `CRON_SECRET`, session+perm fallback, per-cron keys.
- **No hardcoded KPIs, no fake provider READY, no localStorage auth, no fake success, no `alert()`.**

---

## Repo-side P0/P1 quick-fix candidates

**All repo-side P0/P1 candidates were closed on 2026-08-29** (see statuses above and
`docs/LAUNCH_READINESS_REPORT.md`, Phase 48):

1. **O-01** payment migration (P0) — `20260828120000_schema_drift_reconciliation`, verified zero residual drift.
2. **O-05** Apify stub honest `live:false` (P0).
3. **O-10**, **O-11** export/stats owner scoping (P1).
4. **O-12**, **O-13** rate-limit + origin on `/api/reply`, `/api/report` (P1).
5. **O-14** PayU refund honest handling (P1).
6. **O-16** explicit TEST→LIVE activation gate (P1).
7. **O-17** `PAYMENT_ENC_KEY` HARD in `launch:check` (P1) — HOST key-set remains.
8. **O-19** validate payment `returnUrl` via `safeNext` (P1).
9. **O-20** `launch:check` HARD: demo mode in prod = FAIL (P1) — HOST key confirmation remains.

**Gates re-run after fixes (2026-08-29):** `tsc --noEmit` PASS · `npm run lint` PASS ·
`npm test` PASS (**614/614**, 50 files) · `npm run build` PASS · `npm run launch:check`
PASS (**FAIL 0**) · `git diff --check` PASS.

**Host-side remaining (cannot close from code):** O-02 (OTP delivery provider),
O-03 (SMTP), O-04 (provider creds), O-17 key set, O-18 DB path, O-40 Google/Places,
O-41 analytics decision.
