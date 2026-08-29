# LAUNCH-BLOCKERS — HospiOS SaaS Management App (Phase 3)

**Product scope (confirmed):** the SaaS management application only — public marketing site,
online-presence/reputation score tool, and the SaaS platform (organizations, property
claims/scoring, subscriptions, billing, affiliate/partner/franchise, support, RBAC, lead-gen CRM).
The operational hotel PMS (rooms/reservations/folios/etc.) is **out of scope** for this landing —
it exists only as marketing copy (`lib/modules.ts`) and is not built.

**Branch:** `release/financial-hardening-2026-08-24` (HEAD `00b0deb` + Phase 3 working tree)
**Date:** 2026-08-29

Severity:
- **P0** = security/data-corruption/core workflow impossible
- **P1** = major customer workflow broken
- **P2** = important but a workaround exists
- **P3** = post-launch improvement

---

## P0 — Must fix before launch

| ID | Area | Evidence | Status |
|----|------|----------|--------|
| B-1 | Auth / onboarding entry | `redirect("/login")` pointed at a **non-existent** `/login` route (no such page; auth UI lives inline on `/account`). Signed-out users hitting `/account/settings/*` were redirected to a dead route -> auth entry broken. | **RESOLVED 2026-08-29** — 11 pages (3 account-settings + layout, 8 `/saas/*` pages) now redirect to `/account?next=...` which surfaces the AuthCard and returns the user post-login. Verified `redirect("/login")` count = 0. |

**P0 remaining:** none in repo.

---

## P1 — Major workflow broken / real risk (fix or explicitly accept with mitigation)

| ID | Area | Evidence | Status |
|----|------|----------|--------|
| B-2 | Observability | **No unauthenticated `/api/health` liveness endpoint**; deployment/load-balancer monitoring had nothing to probe (only auth-protected `/api/saas/health`). | **RESOLVED 2026-08-29** — added `GET /api/health` (200 `{ok,db:"up"}` / 503 when DB down, never leaks secrets) + `tests/integration/health-route.test.ts`. |
| B-3 | Idempotency (finance) | `lib/saas/gateway.ts:41,90` — `createInvoice`/`recordPayment` **accept but do not enforce** caller `idempotencyKey` (no stored key column). Duplicate *invoice* rows can be created; payment duplicate is largely prevented by the in-transaction outstanding-balance cap, but invoice dedup is absent. | **OPEN — ACCEPTED WITH MITIGATION.** Strong transactional protection already exists (race-safe overpay cap, `@@unique` on webhook event/providerRef/providerPaymentId). Full `idempotencyKey` enforcement needs a schema column + migration; deferred to avoid a financial-schema change immediately pre-launch. Mitigation: callers derive deterministic keys; webhook reconcile is replay-safe. |
| B-4 | Settings behavior | SMTP (`smtp_host/port/user/pass/from`) and integration API-key settings are **persisted but not wired**: `lib/mailer.ts` and `lib/config.ts` read transport/keys from env, not the DB resolver (grep: no consumer of `resolveSetting("smtp_*")`). Changing them in `/saas/settings/email` or `/integrations` does **not** change behavior. | **OPEN — documented.** Do not promote as functional in customer-facing docs; set env at host. |
| B-5 | Observability | No structured logger / request-ID middleware; errors surface via Next `error.digest` + ad-hoc `console.*`. | **OPEN — accepted.** Root + per-plane error boundaries exist and surface `error.digest` for diagnosis. |

---

## P2 — Important, workaround exists

| ID | Area | Evidence | Status |
|----|------|----------|--------|
| B-6 | Dependency audit | `npm audit` — **6 high** vulnerabilities, all **transitive build-tooling**: `deepmerge-ts` (via `prisma` CLI), `postcss` (bundled in `next`), `sharp` (libvips CVEs in `next/image`). "Fix" = `audit fix --force` -> **breaking major upgrades** (`next@16`, `prisma@6.12`) — **not auto-applied**. | OPEN — no end-user runtime exposure path (build-time CSS, image opt, CLI). Re-evaluate after launch. See `docs/LAUNCH_READINESS_REPORT.md` Phase 48 for detail. |
| B-7 | Public free-score tool | `app/free-score/page.tsx:180-183` hardcodes sample scores (82/88/41/63) while page `metadata` claims "Real Google Data". Marketing surface; misrepresents as live data. | OPEN — P2 (public marketing tool, not production dashboard). |
| B-8 | Origin-less requests | `lib/marketing/guard.ts:102` — `originAllowed` returns **true when Origin header absent**. Deliberate (non-browser clients); global middleware covers browsers. | OPEN — accepted design tradeoff. |

---

## P3 — Post-launch improvement

- Affiliate/franchise/partner notification wiring gaps; notification `userId` key consistency (see `LAUNCH_READINESS_ISSUES.md` O-26/O-27).
- Score history is JSON-file based (`SCORE_HISTORY_DIR`), not a DB model — backup via `PRODUCTION_DATABASE_BACKUP.md`.
- Marketing home (`app/page.tsx`) hardcoded hero stats (`500+`, `50+`, `23`, `4.9/5`) are promotional copy by design.
- Full `idempotencyKey` column + enforcement on gateway (B-3 follow-through).
- Structured logging / request-correlation IDs.
- Track-only marketing beacon coverage of all conversions (`/api/marketing/track`).
- Legacy `/api/leads/**` parallel lead store vs new `lib/marketing/**` CRM (consolidate).

---

## Regression / gates (2026-08-29, after Phase 3 fixes)

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test -- --no-file-parallelism` — **PASS 615/615** (51 files)
- `npm run build` — PASS
- `npm run smoke` — **PASS 14/14**
- `npm run launch:check` — PASS (FAIL 0)
- `npm audit` — 6 high (transitive build-tooling; no force fix — see B-6)
- `git diff --check` — PASS
