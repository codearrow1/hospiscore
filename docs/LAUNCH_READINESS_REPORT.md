# Phase 48 — Final Product Launch Readiness (Report)

**Branch:** `release/financial-hardening-2026-08-24` (clean at HEAD `95c6a0d`)
**Date of verification:** 2026-08-29
**Scope:** Repository-side closure of all `LAUNCH_READINESS_ISSUES.md` (Phase O / Phase 37)
P0 and P1 code-fix candidates, followed by a full re-run of every release gate. No new
features, no deploy, no push, and no GitHub-ruleset changes performed.

---

## 1. Summary

Phase 48 closed all **repo-side** P0 and P1 items from the launch-readiness audit. Each fix
was verified with a targeted test where it was testable, then the entire release pipeline was
re-run from a clean working tree state.

| Gate | Result |
|------|--------|
| TypeScript (`tsc --noEmit`) | PASS (exit 0) |
| ESLint (`npm run lint`) | PASS (exit 0) |
| Full test suite (`npm test -- --no-file-parallelism`) | PASS — **614/614** across 50 files |
| Production build (`npm run build`) | PASS (exit 0) |
| Automated launch check (`npm run launch:check`) | PASS — **FAIL 0** (WARN + NOT-VERIFIED only) |
| `git diff --check` | PASS (no whitespace errors; only inert LF→CRLF notices) |

The payment integration suite now carries **40 tests** (up from 37), including regression
tests for the two new payment safeguards (O-16 TEST→LIVE gate, O-19 returnUrl sanitization).

---

## 2. Issues Closed (Repo-Side)

### P0
- **O-01 — Payment persistence layer had no migration.** Added
  `prisma/migrations/20260828120000_schema_drift_reconciliation/migration.sql` (182 lines),
  generated from `prisma migrate diff`. Verified on a fresh scratch DB that a full
  `prisma migrate deploy` (22 migrations) now converges to the current Prisma schema with
  **zero residual drift** (post-migration `migrate diff` is empty). `control-plane.smoke.test.ts`
  applies the new migration on init and passes.
- **O-05 — Apify review provider was a dishonest stub.** `lib/providers/reviews.ts` now returns
  `live: false` (was `live: true` while returning zero data), so a misconfigured
  `REVIEW_PROVIDER=apify` no longer silently claims live OTA data.

### P1
- **O-10 — Export bypassed owner scoping.** `app/api/marketing/export/route.ts` now requires
  `hasCapability(user, "leads.manage")` to choose `owner`; non-managers are scoped to their own
  email.
- **O-11 — Stats leaked org-wide data to non-managers.** `app/api/marketing/stats/route.ts`
  scopes metrics to the caller for non-managers and reduces `users` to the caller's own record;
  managers still get `listUsers()`.
- **O-12 — Unauthenticated/rate-limited DeepSeek endpoint.** `app/api/reply/route.ts` switched
  to `NextRequest` and added `originAllowed(request)` (403) + `rateLimit(IP, 20, 60_000)` (429).
- **O-13 — Open email-send / lead-pollution vector.** `app/api/report/route.ts` switched to
  `NextRequest` and added `originAllowed(request)` (403) + `rateLimit(IP, 10, 60_000)` (429).
- **O-14 — PayU refund honest handling.** Removed `refund` from PayU's capability set
  (`lib/saas/adapters/payu.ts` and `capabilityMatrix.ts`) so the 501 is surfaced consistently
  rather than advertised as available.
- **O-16 — No explicit TEST→LIVE activation gate.** `SaveProviderInput.confirmLiveActivation`
  added; `saveProviderConfig` in `lib/saas/payments/store.ts` now rejects an unreviewed
  `mode: "live"` (persisted mode not already `live`) unless `confirmLiveActivation` is set.
  Wired through `app/api/saas/payments/providers/route.ts`.
- **O-17 — `PAYMENT_ENC_KEY` not enforced in prod.** `scripts/launch-check.ts` now includes a
  **HARD** check requiring `PAYMENT_ENC_KEY` when `NODE_ENV === "production"`.
- **O-19 — Payment `returnUrl` open-redirect.** `lib/saas/payments/intents.ts` sanitizes client
  `returnUrl`/`cancelUrl` through `safeNext` before forwarding to providers, falling back to
  `/customer/checkout/<id>` and `/customer/billing`.
- **O-20 — Demo mode not caught in prod.** `scripts/launch-check.ts` now includes a **HARD**
  check failing when a live (non-demo `CONFIG.live`) data mode is not active in production.

---

## 3. New Tests

`tests/integration/payments.test.ts` (now 40 tests):

- **O-16 gate test** — saving an already-TEST provider as `mode: "live"` **without**
  `confirmLiveActivation` is rejected (throws); with the flag it is accepted.
- **O-16 "already in LIVE" flip test** — a provider already persisted as `live` can be edited/
  re-saved as `live` without re-confirmation (no spurious re-ack).
- **O-19 returnUrl test** — an external/absolute `returnUrl` is sanitized to the in-app checkout
  fallback instead of being forwarded verbatim to the provider as a `success_url`.

The full suite (614 tests) and the new migration-application smoke test both pass.

---

## 4. Automated Launch Check (`npm run launch:check`)

Result: **FAIL 0 / exit 0**. The only remaining rows are:
- **WARN advisories** — env inventory rows for host-provided keys, and the tracked-but-
  secret-free `.env.production` (see Section 6, L-07).
- **NOT VERIFIED** — items requiring the live host: `PAYMENT_ENC_KEY`, `prisma migrate status`
  (no local `DATABASE_URL` here), and start-command wiring.

The two new **HARD** checks (PAYMENT_ENC_KEY in prod; live data mode in prod) render as PASS in
this local (`NODE_ENV != production`) environment and go live as informational/pass confirmation
at the host.

---

## 5. Documentation Deliverables (this phase)

- `docs/LAUNCH_READINESS_ISSUES.md` — all closed repo-side items marked **RESOLVED**, with
  verification dates; remaining host items explicitly tagged **HOST-OPEN**.
- `docs/LAUNCH_READINESS_REPORT.md` — this report (Phase 48).

---

## 6. What Remains (Host-Side — Requires Deployment/Environment Access)

These are outside repo code and are **not closed by this phase**; they block or gate a live
launch and require Hostinger/host actions:

- **O-02** — claim OTP delivery needs an SMS/email provider (plus a repo delivery hook).
- **O-03** — password-reset email needs SMTP configured (`SMTP_HOST`/`SMTP_USER`).
- **O-04** — a payment provider must be provisioned and set `verify`/`ready` (provider-neutral at launch).
- **O-17** — set `PAYMENT_ENC_KEY` (AES-256-GCM, `openssl rand -hex 64`) at the live host.
- **O-18** — pin `DATABASE_URL` to a durable path (currently temp `file:C:/Temp/saas.db`).
- **O-40** — set `GOOGLE_PLACES_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to leave demo mode.
- **O-41** — make the analytics/beacon decision.
- **L-07 / best practice** — `git rm --cached .env.production` (a commit; not done, as no push/
  commit beyond the authorized scope was requested).

P2/P3 items (O-21…O-57) remain OPEN by design as post-launch improvements; none is a launch
blocker in the repo.
