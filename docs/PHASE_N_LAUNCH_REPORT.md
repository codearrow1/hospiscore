# Phase N — Launch Readiness + Production Configuration Audit (Report)

**Branch:** `release/financial-hardening-2026-08-24`
**Date of verification:** 2026-08-28
**Scope:** Repository-side launch preparation only. No push, no live-provider activation,
no real-payment execution, no GitHub-ruleset changes, and no production deployment performed.

---

## 1. Summary

Phase N re-audited the release state and delivered the launch-critical fixes and tooling that
were still outstanding from the financial-hardening work. All repository-side gates now pass:

| Gate | Result |
|------|--------|
| TypeScript (`tsc --noEmit`) | PASS (exit 0) |
| ESLint (`npm run lint`) | PASS (exit 0) |
| Full test suite (`npm test`, serial) | PASS — **611/611** across 50 files |
| Production build (`npm run build`) | PASS (exit 0) |
| Automated launch check (`npm run launch:check`) | PASS — **FAIL 0** (WARN + NOT-VERIFIED only) |
| `git diff --check` | PASS (no whitespace errors) |

The single parallel-run test failure observed (`EBUSY: resource busy or locked, var/data.json`)
is a pre-existing flaky concurrency file-lock in the JSON store when test files run in parallel,
not a regression. It passes consistently under serial execution.

---

## 2. Code Fixes Delivered

### 2.1 P0 — Connection-test masking bug (`lib/saas/payments/validate.ts`, `factory.ts`)
Plaintext `.masked` secret bundles are now threaded into the adapter via an optional
`transport?: HttpTransport` argument (`instantiateAdapter(cfg, transport)`). Freshly-entered
secrets are placed into the bundle as plaintext (not display-masked), so connection tests no
longer fail with 401. Regression test added to `tests/integration/payments.test.ts` (37 tests).
Bundles stay server-memory-only; store still returns masked views to clients.

### 2.2 P0 — Privilege escalation (`app/api/marketing/users/[id]/route.ts`)
Routes that assign roles now call `roleFor(guard.user)`. Only an existing Super Admin may
assign Super Admin, and no non-super-admin may change their own role. This prevents a
`marketing_manager`/`analyst` with `settings.manage` from promoting itself to `super_admin`
(and thereby inheriting the full SaaS permission set via the `saasRoleFor` fallback).

### 2.3 HIGH — SaaS-only roles persistence (`lib/marketing/users.ts`)
New exported `isStorableRole(role)` accepts the union of marketing roles and SaaS-only roles
(via `isSaasRole`). `setUserRole` now accepts the full separation-of-duties set
(`finance_admin`, `support_admin`, etc.) instead of rejecting them. Imports only `isSaasRole`
to avoid a module cycle; unused `SAAS_ROLES` import removed.

### 2.4 P18 — Control-plane diagnostics gate (`app/api/saas/admin/control-plane-diagnostics/route.ts`)
Added `SYSTEM_SETTINGS_MANAGE` (Super Admin) guard after `requireMarketingUser()` auth,
matching the endpoint's documented "Super-admin-only" contract.

### 2.5 P25 — Dead `/login` redirect
Eleven internal pages changed `redirect("/login")` → `redirect("/account")` (the real sign-in
surfaced in the account flow). Verified 0 references to `redirect("/login")` remain.

### 2.6 P26 — SEO robots bug (`app/robots.ts`)
Replaced the nonexistent `/property/` with `/properties/*/claim`; added internal panels to the
disallow list (`/saas`, `/customer`, `/dashboard`, `/subadmin`, `/marketing-admin`, `/staff`,
`/partner`, `/affiliate`); preserved `/account` and `/api`.

---

## 3. Launch Blockers

### 3.1 Resolved (repo-side)
- **L-01..L-08** — all resolved by the code fixes in Section 2, the new launch gate, and the
  provider/status invariants (no provider is CONFIGURED/READY; launch is provider-neutral).
- **Demo-seed gate** — `.env.production` previously contained `ALLOW_DEMO_SEED=1`, which allowed
  demo seeding (incl. `superadmin@hospios.demo`) in production (`lib/marketing/seed.ts:20`).
  Now set to `ALLOW_DEMO_SEED=0`; enforced by `launch:check`.

### 3.2 Open / Not Verifiable without host access
- **L-20..L-26** — host-side actions (env secrets on Hostinger, `SITE_URL`, DB init, provider
  keys, hPanel runtime). **ALL BLOCKED / NOT VERIFIED** — no access to
  `hosts.gateway.hostinger.com`.
- **L-07 (WARN)** — `.env.production` is still tracked by git. It is verified secret-free
  (only `ALLOW_DEMO_SEED=0`), so `launch:check` reports WARN not FAIL. Full closure requires
  `git rm --cached .env.production` (a commit — NOT done, as no commit/push was authorized).

---

## 4. Automated Launch Check (`scripts/launch-check.ts`, `npm run launch:check`)

Checks env inventory, provider integrity (via `getRawProviderConfigs`/`getProviderConfigs`),
provider status invariants (`canRoutePayment` only for `ready`/`verify`), DB startup wiring,
routing (no dead `/login` redirects), secrets hygiene, and production flags (demo-seed
disabled). Result: **FAIL 0 / exit 0**; the only remaining rows are WARN advisories and
3 NOT-VERIFIED items that require live-host confirmation.

---

## 5. New Tests — Provider Consistency + Financial Invariants

`tests/unit/provider-consistency.test.ts` (7 pure tests, no DB):

- Status machine: only `ready`/`verify` route a payment; `registered`,
  `verification_failed`, `disabled`, `misconfigured` never route even when enabled.
- `registered` (unwired) is never routable, guarding the READY-only rule.
- Separation of duties: `super_admin` holds all cross-cutting capability; `finance_admin`
  can `REFUND_APPROVE` but not `FINANCIAL_APPROVE`/`SYSTEM_SETTINGS_MANAGE`/`PLAN_MANAGE`;
  `support_admin` is scoped to support and never gains financial or platform powers.
- `SAAS_ROLES` is a closed, non-empty role list.

---

## 6. Documentation Deliverables

- `docs/PRODUCTION_ENVIRONMENT.md` — env inventory + security rules.
- `docs/PAYMENT_WEBHOOKS.md` — webhook endpoint, signature-verification model, prod checklist.
- `docs/PRODUCTION_DATABASE_BACKUP.md` — SQLite `.backup`, JSON, enc key, retention, DR.
- `docs/PRODUCTION_RUNBOOK.md` — ops runbook, escalation, payment ops, incident response.
- `docs/LAUNCH_BLOCKERS.md` — L-01..L-08 RESOLVED, L-20..L-26 OPEN/NOT VERIFIED, L-07 WARN.

---

## 7. What Remains (Explicitly Out of Scope — Requires Authorization)

1. `git rm --cached .env.production` + commit (best-practice closure of L-07 WARN).
2. Push of this branch (commits already on `release/financial-hardening-2026-08-24` at
   `ea06278`; working tree changes are uncommitted).
3. Hostinger deployment + post-deployment verification (BLOCKED — no access).
4. Live provider activation / real-payment testing (must remain provider-neutral at launch).
