# WHOLE-PROJECT BUILD REPORT — HospiOS ("pms score app")

Comprehensive, evidence-based report of the entire build to date.
Generated 2026-08-29 at commit `0c9f83d` (HEAD, working tree CLEAN). 92 commits total.

---

## 1. Executive Overview

HospiOS is a **hospitality/PMS SaaS management platform + property online-presence scoring product**. It is **NOT** a functioning operational hotel PMS — the operational PMS core (rooms, reservations, front-desk, POS, housekeeping, folios) exists **only as marketing copy** in `lib/modules.ts` (a 23-module catalogue) and is **out of scope** per the owner's explicit direction. The build instead delivers four real, production-structured product planes:

1. **Public marketing site + scores** (home, pricing, solutions, resources, legal, score-check, free-score)
2. **Property online-presence scoring + Google-listing claim/verification**
3. **SaaS commerce control plane** — organizations, plans/country pricing, subscriptions, billing, channels, support, RBAC, audit
4. **Marketing lead-CRM** — pipeline, campaigns, forms, demos, analytics

**Scope note for any engineer/LLM continuing:** do **not** attempt to build the operational PMS. All future work targets the four planes above.

## 2. Identity, Stack & Deployment

- **Repo:** local `C:\Users\Asus\Documents\pms score app` → GitHub `codearrow1/hospiscore`
- **Live (Hostinger, user-managed):** https://thebuddharice.online
- **Branch:** `release/financial-hardening-2026-08-24`
- **Stack:** Next.js 15.5.21 App Router · React 19.2.8 · TypeScript 5.9.3 (strict) · Prisma 6.19.3 (SQLite) · Tailwind 4 · vitest 4.1.10 · eslint
- **Prisma client:** generated to `lib/generated/prisma`, pinned to CJS runtime by `scripts/fix-prisma-runtime.mjs` (runs in `prisma generate` postinstall + `npm run build`)
- **Deploy flow:** push → GitHub → Hostinger auto-build (~4 min). SaaS DB is **self-provisioned** on first SaaS access: replays every migration in `prisma/migrations` exactly once (`_prisma_migrations`), seeds plans idempotently. No prisma CLI required on the server.
- **Demo logins:** `superadmin@hospios.demo / Hospios@Demo2026!` · `marketing@hospios.demo / Marketing@Demo2026!`

### Two independent data planes
| Plane | Store | Contents |
|---|---|---|
| **JSON plane** | `var/data.json` (+ mirror `~/.hospiscore/data.json` via `lib/db.ts`) | marketing site, leads/campaigns/forms/demos, users/sessions, saved searches, score reports |
| **SaaS plane** | `DATABASE_URL` SQLite (prod `file:./var/saas.db`) | full Prisma commerce schema (43 models, 22 migrations) |

Local dev DB: `file:C:/Temp/saas.db` (absolute path — project dir contains spaces; SQLite can't open relative `file:` URLs with spaces).

---

## 3. Scale / Inventory (verified counts)

| Metric | Count |
|---|---|
| Git commits | **92** |
| Prisma schema models | **43** (42 `model` + 1 `view`/`type` set) |
| Prisma migrations | **22** |
| App routes (`app/**/page.tsx`) | **100** |
| API route handlers (`app/api/**/route.ts`) | **152** |
| Test files | **51** |
| Total tests passing | **615** |
| lib `.ts` files | **243** (`lib/{client,db,generated,marketing,pricing,providers,saas,settings}`) |
| Source LOC (`app,lib,components,scripts,prisma,tests`, `.ts/.tsx`) | **~170,163** |
| Product readiness score | **84 / 100** |

### Prisma model list (43)
Organization, OrgContact, Property, PropertyClaim, Plan, PlanCountryPrice, PlanChangeRequest, FinancialApproval, SystemSetting, Subscription, Invoice, Payment, UsageRecord, FeatureFlag, AuditLog, Affiliate, AffiliateClick, AffiliateCommission, AffiliatePayout, DunningCase, Coupon, CouponRedemption, AutomationEvent, SupportTicket, TicketComment, Notification, FranchisePayout, OnboardingProgress, Partner, Franchisee, FranchiseTerritory, AffiliateCampaign, AffiliateCampaignMember, AffiliateSetting, AffiliateApplication, AffiliateFraudCase, AffiliateAgreement, AffiliatePerformanceTier, AffiliateAttribution, AffiliateNotification, AffiliateAsset, AffiliateRecruitment, UserPreference.

> **No PMS models exist** (no Room/RoomType/Reservation/Guest/Folio/Order/HousekeepingTask/etc.). `Property` is a scoring/Google-`placeId` listing (with `rooms Int` count + `pmsInstanceUrl`), not an operational property record.

---

## 4. Build History — 12 delivery phases (consolidated from 92 commits)

The build progressed in distinct phases. Key sequence (newest first in log, but reconstructed chronologically):

| Phase | Focus | Representative commits |
|---|---|---|
| **0 — Foundation** | Initial scaffold, Next 15 downgrade for Hostinger, security patches (5.15.21), score-check landing, lead-gated report unlock, live property resolution | `e03130b`, `ad35c1b`, `70aec63`, `d6c6526`, `0e6b1b4` |
| **1 — Scoring platform** | Property search → presence score (website/social/reviews/listings) → gated report, market context, review intelligence, AI replies (console/webhook mailer), weekly alert digests (`npm run alerts`), Apify review-provider stub | early commits |
| **2 — Marketing site + admin** | Public marketing pages, lead capture, `/marketing-admin`: leads pipeline, campaigns, forms builder, demo requests | `fa0841a` (Phase 5), legacy retirement |
| **3 — SaaS commerce control plane** | `/saas` command center, Organizations, Subscriptions, Invoices/Payments/Dunning state machines + cron, Usage meters, Feature flags, Coupons, Support tickets, Audit log, Health/db-diag, Demo seeder | `245671d`, `83812b6`, `99bc220`, `2fb37c7` |
| **4 — Channel networks** | **Affiliate** (`/?ref=CODE`, 90-day cookie, commission ledger), **Partner** (resellers, PRX code, shares ledger via `partnerId`), **Franchise** (territory tree, revenue share) | `1fd029f` (Phase 6), `379e677` |
| **5 — Unified marketing CRM** | leads, pipeline, demos, analytics, forms + legacy retirement | `245671d`, `fa0841a` |
| **6 — Role portals / self-service** | role portals, staff queue (`SUPPORT_VIEW`), password reset, onboarding checklists, customer self-service APIs, support ticket replies, notifications, PDF invoices | `9f266b0`, `245671d` |
| **7 — UX/design maturity (Phases 8–11)** | mobile-first (bottom nav, filter sheets, kanban chips), a11y + i18n readiness, palette actions/recents, chart axes/legends/tooltips, dead-code removal, dark mode, error boundaries, 404 | `2fb37c7`–`7bc741c` |
| **8 — Settings architecture (Phases A–J)** | personal/team/org/platform/affiliate settings, unified settings layout, user preferences, billing null-safety | `ecab145`, `499ed80`, `c64c1cd`, `1c1887e` |
| **9 — SaaS control-plane resilience** | `ensureQueryEngineEnv` before `initSaasDb`, `initSaasDb()` in saas layout, client-safe constants, error boundaries | `37b7889`, `386621f`, `455f16a`, `e448250` |
| **10 — Audit hardening series** | multiple deep audits: 30 issues/28 files, scalability (table scans → SQL aggregations, N+1 → batch loading), 17 critical/high bugs, P0/P1/P2 (commission wiring, portal bugs, holding-period fix, batch updates), build-breaking type fixes, to move `themeColor` to `viewport` | `7f54e0c`, `41b4d12`, `a0dcefd`, `39ec9e0`, `334e823`, `727b2e7`, `ba21e30`, `ff7a952`, `386621f` |
| **11 — Pricing & multi-currency architecture (production-verified)** | `Plan.marketingPlanId` catalog linkage, `PlanCountryPrice` for 16 countries / 15 currencies, US-cents billing invariant, canonical sync path (`lib/saas/pricingSync.ts`), marketing-approval gate (`PlanChangeRequest`), market-snapshotted subscriptions | `ecab145`–`00b0deb` lineage, `642c957` verification |
| **12 — Financial hardening + launch readiness** | payment platform finalization + four-eyes gates, `app/api/health` + `smoke` gate, P0 dead-login fix, launch reports | `ea06278`, `95c6a0d`, `00b0deb`, `0c9f83d` |

---

## 5. Key Subsystems (what is built)

### A. Scoring platform
Property search → presence score → gated email report (`ReportEmailForm`, `POST /api/report`), market context, review intelligence, AI reply draft, weekly alert digests (`npm run alerts`), Apify review-provider stub.

### B. Marketing site + admin
Public pages (`/pricing`, `/platform/[slug]`, legal/trust/resources hubs), lead capture, `/marketing-admin` (pipeline/campaigns/forms/demos/users). `lib/marketing/*` (16 files: leads, campaigns, demos, events, followups, forms, guard, metrics, roles, scoring, seed, stages, track, types, users, audit).

### C. SaaS commerce control plane (`/saas` + `app/api/saas/**`, 37 subpages)
Command center metrics (real aggregates: MRR/ARR/churn via `lib/saas/metrics.ts`), Organizations CRUD, Subscriptions, Invoices/Payments/Dunning (state machines + cron `POST /api/saas/cron/dunning|automation` with `X-Cron-Secret`), Usage meters, Feature flags, Coupons, Support tickets + SLA, Audit log, Analytics, Health/db-diag, Demo seeder (`ALLOW_DEMO_SEED=1`, idempotent).

### D. Pricing & multi-currency (most recent, production-verified)
- Catalog linkage via `Plan.marketingPlanId` to `lib/pricing/catalog.ts` PLANS. Active commercial set: Solopreneur $49 / Starter $89 / Growth $179 / Professional $299; Enterprise custom (`isCustomPrice`).
- `PlanCountryPrice` for 16 countries (AE,AU,BD,CA,DE,FR,GB,IN,KE,LK,NG,NP,PK,SG,US,ZA; 15 currencies).
- US billing invariant: `Plan.monthlyPrice/annualPrice` = USD **cents** = US storefront ×100 (enforced).
- Canonical sync applier: `lib/saas/pricingSync.ts` (bidirectional SaaS Admin ↔ Marketing Admin, approval-gated).
- Subscriptions market-snapshotted (`country`, `currency`, `unitAmount nullable`); charged currency never converted; `mrr` separate USD-cents metric.
- Tests: `lib/saas/pricingSync.test.ts` + `scripts/verify-pricing-reqs.ts` (28 checks A–J).

### E. Channel networks (3 concepts)
1. **Affiliate** — referral marketers, `AFFxxx`, `/?ref=CODE`, 90-day httpOnly cookie, default 2000bps `percent_mrr_12`. Portal `/affiliate`.
2. **Partner** — active resellers, `PRX`, default 1500bps `percent_first`, owns `organizations[]`. Portal `/partner`. Shares ledger with affiliates.
3. **Franchisee** — territory operators (NOT referrals); `FranchiseTerritory` tree master→region→city with exclusivity conflict detection; revenue share default 1500bps × aggregate territory MRR. **Gap:** no payout-ledger integration, no portal, no geo-auto-assignment.

### F. RBAC
Real roles live in `lib/rbac.ts` (AppRole), `lib/saas/roles.ts` (`SAAS_ROLES`), `lib/marketing/roles.ts`. Permission matrix + `hasSaasPerm` super-admin/read_only handling. **The "10 PMS roles" from the generic product brief do not exist** — they are marketing terms.

---

## 6. Security, Data Integrity & Payment Hardening

- **Payments:** provider-abstracted gateway (`lib/saas/gateway.ts`; Stripe/Adyen/PayU + catalog). Webhook-authoritative reconciliation, replay-safe via `@@unique([provider,eventId])`, secrets AES-256-GCM masked. `recordPayment` (gateway.ts:99-147) is transactional with an outstanding-balance cap to stop overpay/races. Four-eyes refund approvals. Adyen `getPaymentStatus` = `pending`-only stub; PayU test host + 501 refund (refund capability removed in Phase 12).
- **Tenant isolation:** `requireCustomerOrg()` scopes customer APIs to caller org; `resolveOrgForUser` has an email-match fallback (weaker than explicit binding).
- **Ledger integrity:** commission/payout state machines (pending→eligible→approved→payable→paid + rejected/reversed/fraud_hold).
- **Origin/rate-limit guards** in `lib/marketing/guard.ts` (note: `originAllowed` returns true when Origin absent — accepted).
- **Audit:** immutable `AuditLog` on admin/commerce mutations.

---

## 7. Observability, Health & Smoke Gates (Phase 12 additions)

- **`GET /api/health`** (public): 200 `{ok, app:"ok", db:"up"}` / 503 when DB down; never leaks secrets; + integration test (`tests/integration/health-route.test.ts`).
- **`npm run smoke`** (`scripts/smoke.ts`): 14 non-destructive checks — DB `SELECT 1`, `initSaasDb`, session config, SAAS_ROLES/permission matrix, tenant guard exports, origin/rate-limit guards, Prisma engine responsiveness, optional live HTTP probe via `SMOKE_BASE_URL`, real numeric metrics. **14/14 PASS.**

---

## 8. Gate Results (final, 2026-08-29)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **PASS** |
| Lint | `npm run lint` | **PASS** |
| Tests | `npm test -- --no-file-parallelism` | **PASS 615/615** (51 files) |
| Build | `npm run build` | **PASS** |
| Smoke | `npm run smoke` | **PASS 14/14** |
| Launch check | `npm run launch:check` | **PASS** (FAIL 0; host items NOT VERIFIED) |
| Deps | `npm audit` | **6 high (transitive build-tooling)** — no force fix |
| Diff check | `git diff --check` | **PASS** (inert LF→CRLF notices) |

**Test runner caveat:** must run with `--no-file-parallelism` to avoid a known JSON-store file-lock flake (`EBUSY var/data.json`).

**`npm audit` detail:** the 6 high severity are **transitive build-tooling** (`deepmerge-ts` via prisma CLI, `postcss` + `sharp` bundled inside `next`). Force-fixing would require **breaking** upgrades (`next@16`, Prisma bump), so they are intentionally **not** applied and documented instead.

---

## 9. Remaining Open Items (accepted / host-provisioned)

### Host-side provisioning (blocking-ish for full production, NOT repo-fixable)
- Real SMTP transport (currently console/webhook mailer stub) — `SMTP_HOST/USER/PASS/FROM`
- Payment-provider credentials + `PAYMENT_ENC_KEY`
- `GOOGLE_PLACES_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (leave real-data mode; score tool otherwise uses demo data)
- Durable `DATABASE_URL` (currently temp `file:C:/Temp/saas.db` in .env; prod uses `file:./var/saas.db`)
- `NEXT_PUBLIC_SITE_URL` / `SITE_URL`, `CRON_SECRET`, `AFFILIATE_CRON_KEY`

### Accepted P1/P2 (documented in `docs/LAUNCH-BLOCKERS.md`, verified)
- Gateway `createInvoice`/`recordPayment` don't enforce caller `idempotencyKey` (no stored column) — mitigated by transactional overpay cap + unique provider/webhook keys.
- SMTP/integration settings persisted but read from env (decorative in UI until env set).
- No structured logger / request-IDs (uses Next `error.digest`).
- Free-score tool (`app/free-score/page.tsx:180-183`) hardcodes sample scores while copy implies live data.
- Franchisee revenue share not wired to payout ledger; no franchisee portal; no geo-auto-assignment.
- P3 items: notification wiring, score-history DB model, legacy `/api/leads` vs `lib/marketing` consolidation, structured logging, full idempotency-key column.

---

## 10. Launch Decision

```
LAUNCH STATUS: CONDITIONAL  (repo-ready; host provisioning required)
OVERALL PRODUCT READINESS: 84/100
P0 = 0  (repo-level blockers resolved)
```

Consolidated in `docs/LAUNCH_BLOCKERS.md` (P0/P1/P2/P3 + evidence), `docs/LAUNCH_ACCEPTANCE_MATRIX.md` (critical workflows, all PASS), `docs/PRODUCT-LAUNCH-READINESS.md` (final Phase 48 report), all updated at `0c9f83d`.

---

## 11. Documentation Map

| Doc | Purpose |
|---|---|
| `PRODUCT-LAUNCH-READINESS.md` | Final Phase 48 launch report + business acceptance (**new, 0c9f83d**) |
| `LAUNCH-BLOCKERS.md` | Phase 3 blocker register, all verified (**new, 0c9f83d**) |
| `LAUNCH_ACCEPTANCE_MATRIX.md` | Critical-workflow acceptance matrix (**new, 0c9f83d**) |
| `PROJECT_CONTEXT.md` | Master handoff (verified at `642c957`) |
| `LAUNCH_READINESS_ISSUES.md` | Phase O/37 issue register (O-01…O-57) |
| `LAUNCH_READINESS_REPORT.md` / `PHASE_N_LAUNCH_REPORT.md` | Launch-check phase reports |
| `PRODUCTION_{ENVIRONMENT,RUNBOOK,DATABASE_BACKUP}.md` | Prod config, runbook, DB backup |
| `DEPLOY-SAAS.md` | Server env, self-provisioning, crons, rollback |
| `PAYMENT_{ENV,PROVIDERS,WEBHOOKS}.md` | Payment platform setup |
| `AGENTS.md` | Historical phase log + open-ideas list |
| `rbac-merge-audit.md`, `rbac-saas-merge-report.md`, `SETTINGS_AUDIT_PHASE_A.md`, `pricing-structure-audit.md`, `pricing-sync-approval.md`, `demo-credentials.md` | Subsystem audits/credentials |

---

## 12. State & Commit Policy

- **HEAD:** `0c9f83d` — "Phase 3 product completion + SaaS launch acceptance" (18 files, +650/−11). Working tree **CLEAN**.
- **NOT pushed, NOT deployed** (user manages Hostinger deploy). Commits created only when explicitly requested.
- Prior milestones: `00b0deb` (Phase 48), `95c6a0d` (Phase N), `ea06278` (financial hardening), `642c957` (pricing production verification).

---

## 13. Guidance for the Next Engineer / LLM

1. **Do not build the operational PMS** — confirmed out of scope by the owner; the 23-module catalogue is marketing copy only.
2. Work within the four real planes (marketing+scores, scoring/claim, SaaS commerce, marketing CRM).
3. After any change, re-run the six gates; **always use `--no-file-parallelism`** for the test suite.
4. If extending launch readiness, natural next targets are the accepted P1s (gateway idempotency-key column, structured logging), franchisee payout wiring, and host-side provisioning handoff.
5. Commit only when the user asks; push only when the user asks.
