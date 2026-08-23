# PROJECT CONTEXT — HospiOS / "pms score app"

Handoff document for any LLM/engineer continuing work. Facts verified as of commit `642c957` (2026-08-23).

## Identity & Stack

- **Product**: HospiOS — hotel/hospitality PMS SaaS + property online-presence scoring platform. Live at https://thebuddharice.online
- **Repo**: local `C:\Users\Asus\Documents\pms score app` → GitHub `codearrow1/hospiscore` (branch `main`)
- **Stack**: Next.js 15.5.21 App Router · TypeScript strict · Prisma 6.19.3 + SQLite · Tailwind · vitest (253 tests) · eslint
- **Prisma client**: generated into `lib/generated/prisma`, then pinned to CJS runtime by `scripts/fix-prisma-runtime.mjs` (runs automatically inside `prisma generate` postinstall + `npm run build`)
- **Deploy**: push to GitHub → Hostinger auto-deploys (~4 min). The app **self-provisions** the SaaS DB on first SaaS access: creates dir, replays every migration in `prisma/migrations` exactly once (`_prisma_migrations`), seeds plans idempotently. No prisma CLI needed on server.
- **Deploy marker**: after a new build lands, previously-nonexistent API routes return JSON 401 instead of Next.js HTML 404. Also check `/api/saas/subscriptions` response fields for schema-level proof.
- **Demo logins** (local + prod): `superadmin@hospios.demo / Hospios@Demo2026!`, `marketing@hospios.demo / Marketing@Demo2026!`

## Data planes (two independent stores)

1. **JSON plane** (`var/data.json`, mirrored to `~/.hospiscore/data.json` via `lib/db.ts`): marketing site, leads/campaigns/forms/demos, users/sessions, saved searches, score reports. Backend auto-selects file vs sqlite (`DATA_PROVIDER`). Self-recovers from mirror if wiped.
2. **SaaS plane** (`DATABASE_URL` SQLite, e.g. prod `file:./var/saas.db`): full commerce schema in `prisma/schema.prisma` — Organization, Subscription, Plan, PlanCountryPrice, Invoice/Payment/DunningCase, UsageRecord, FeatureFlag, SupportTicket, AuditLog, Affiliate/Click/Commission/Payout, Partner, Franchisee/FranchiseTerritory, SystemSetting, PlanChangeRequest.
- Local dev DB: `file:C:/Temp/saas.db` (.env) — absolute path required because project path contains spaces (SQLite can't open relative `file:` URLs with spaces).
- `tsx` scripts need explicit env: `npx tsx --env-file=.env scripts/<name>.ts`

## Subsystem inventory (what's built)

### A. Scoring platform (oldest phases)
Property search → presence score (website/social/reviews/booking listings) → gated email report (`ReportEmailForm`, `POST /api/report`), market context, review intelligence, AI replies (`lib/mailer.ts` console/webhook transport), weekly alert digests (`npm run alerts`), Apify review provider stub.

### B. Marketing site + admin
Public marketing pages (`/pricing`, `/platform/[slug]`, legal/trust/resources hubs), lead capture everywhere, `/marketing-admin`: leads pipeline (stages/notes/followups/CSV export), campaigns, forms builder, demo requests, marketing users.

### C. SaaS commerce control plane (`/saas`)
Command center metrics, Organizations CRUD, **Subscriptions** (see D), Invoices/Payments/Dunning (state machines + cron `POST /api/saas/cron/dunning|automation` with `X-Cron-Secret`), Usage meters, Feature flags, Coupons, Support tickets, Audit log, Analytics, Health/db-diag, Demo seeder (`ALLOW_DEMO_SEED=1` + super-admin, idempotent).

### D. Pricing & multi-currency architecture (most recent, production-verified)
- **Catalog linkage**: `Plan.marketingPlanId` IS the canonical link to the Marketing pricing catalog (`lib/pricing/catalog.ts` PLANS). Archived Business plan preserved ($199); active commercial set: Solopreneur $49 / Starter $89 / Growth $179 / Professional $299; Enterprise = custom/contact-sales (`isCustomPrice=true`, prices are placeholders 0/49900 — never used for checkout).
- **Country prices**: `PlanCountryPrice(planId,country unique)` — local-currency units (NOT cents) for **16 countries**: AE,AU,BD,CA,DE,FR,GB,IN,KE,LK,NG,NP,PK,SG,US,ZA (15 distinct currencies; DE+FR share EUR). Baseline examples: US starter 89 USD, IN starter ₹1999/₹19990.
- **US billing invariant**: `Plan.monthlyPrice/annualPrice` are USD **cents**, must equal US storefront ×100. Enforced by canonical applier.
- **Canonical sync path**: `lib/saas/pricingSync.ts` — `validateCountryPriceEntries`, `applyCountryPrices` (writes PlanCountryPrice rows + US billing cents + mirrors storefront PricingDoc in one transaction-ish deterministic flow). Used by BOTH directions:
  - SaaS Admin PATCH `/api/saas/plans/[id]` with `countryPrices:[{country,currency,monthly,annual}]` → applies immediately (authoritative) + auto-syncs Marketing.
  - Marketing Admin POST `/api/saas/plan-requests` `{planId,action:"update"|...,patch:{countryPrices}}` → gated by SystemSetting `require_marketing_pricing_approval` (default ON) → pending `PlanChangeRequest`; Super Admin approve/reject via `/api/saas/plan-requests/[id]/approve|reject|cancel`. Approve applies through the same applier (version counter guards stale approvals). Actions cover update/create/archive/activate/deactivate.
- **Subscriptions are market-snapshotted**: columns `country`, `currency`, `unitAmount` (nullable). `unitAmount=null` ⇒ custom/negotiated (Enterprise without override). Charged currency/amount NEVER converted to USD; `mrr` remains a separate USD-cents metric. Create/changePlan resolve price from the market's PlanCountryPrice; renewals use cycle-appropriate duration. GET `/api/saas/subscriptions` supports filters `status,organizationId,planId,country,currency,billingCycle` and returns `countries[]` list. POST accepts `{organizationId,planId,country,billingCycle,status,unitAmount?,startAt?}`.
- **UI**: `components/saas/CountryPricingMatrix.tsx` (all 16 countries × plans editor on `/saas/plans`, consumes `GET /api/saas/plan-prices`); rewritten `SubscriptionsManager` with country/currency columns + filters + multi-currency create modal.
- **Tests**: `lib/saas/pricingSync.test.ts` + scenario script `scripts/verify-pricing-reqs.ts` (28 checks A–J: bidirectional sync, country isolation, gate block/approve/reject, INR/USD/GBP creation, legacy immutability, enterprise null-vs-override). Suite: **253/253**, typecheck/lint/build clean.

### E. Channel networks (3 distinct concepts)
1. **Affiliate (Phase G)** — referral marketers. `Affiliate.referralCode AFFxxx`, link `/?ref=CODE`, `POST /api/affiliate/track` records click (UTM/IP/UA) + sets 90-day httpOnly `aff_ref` cookie. Default commission `percent_mrr_12` @2000bps. Portal `/affiliate`.
2. **Partner (Phase O)** — active resellers/implementers (`it_agency|consultant|reseller|implementation|hmc`), default `percent_first` @1500bps, owns `organizations[]`. Code prefix PRX. Portal `/partner`. Shares ledger with affiliates via nullable `partnerId` on `AffiliateCommission`/`AffiliatePayout`.
3. **Franchisee (Phase P)** — territory operators, NOT referrals. `FranchiseTerritory` tree master(country)→region→city with exclusivity conflict detection; orgs manually assigned (`Organization.franchiseTerritoryId`); revenue = `revenueShareBps` (default 1500) × aggregate MRR of territory orgs (`franchiseePerformance()`); contract machine `proposed→signed→active→terminated`. No portal, no payout-ledger integration yet.
- Shared: `commissions.ts` engine (auto-fires in `createSubscription` when org has affiliateId/partnerId — `subscriptions.ts:191-200`; statuses pending→eligible→approved→payable→paid + rejected/reversed/fraud_hold), `payouts.ts` (requested→approved→processing→paid/failed).

## Production verification record (commit 642c957)

58/59 live-API checks PASS against https://thebuddharice.online: matrix (16 countries, all 64 commercial cells consistent, baseline intact), SaaS→Marketing sync instant + country-isolated, approval gate blocks/applies/mirrors correctly, rejection no-op, USD/INR/GBP subscription snapshots retained verbatim, enterprise null=custom semantics, 10 legacy subs byte-identical across mutations, RBAC smoke clean (anon 401s, marketing 403 on settings). The single non-PASS was byte-diff of PricingDoc `version`/`updatedAt` metadata (legitimately increments per save) — superseded by field-level ALL-PRICES-CONSISTENT=True. Audit trail retains intentional test entries (plan.updated, approved+rejected change requests, temp org created/deleted-cascade).

## Environment pitfalls (learned the hard way)

- **PowerShell 5.1**: `$var` inside double-quoted here-strings gets interpolated (broke `prisma.$disconnect` once); `R` is an alias (Invoke-History) — don't name functions R/A/etc.; aliases outrank functions.
- **PS 5.1 Invoke-RestMethod/WebRequest reuse the WinINET client cache** for responses with `Cache-Control: public` — `/api/pricing/catalog` sends `public, s-maxage=3600` → ALWAYS append a unique `?nocache=<guid>` when probing it, or you'll read stale copies and misdiagnose sync bugs. hcdn itself returns `X-Hcdn-Cache-Status: DYNAMIC` (not the culprit).
- **Stale node.exe processes** holding Prisma DLL cause EPERM during rebuild → kill node processes whose CommandLine matches the project before rebuilding.
- **Plan model has NO `status` column** — use `isActive` + `archivedAt` (a stale `.status` reference in `scripts/check-baseline.ts` broke the Hostinger build once; fixed in 642c957). Ordering field is `displayOrder` (not sortOrder). Other models legitimately have `status` — don't confuse them.
- Build order sensitivity: run `npx tsc --noEmit` AFTER creating any new script — tsx runs untyped, Next build does not.
- Prod catalog writes leave audit rows by design; restore baseline values exactly when testing (`$49/$89/$179/$299`, IN ₹1999, GB £89).

## Known gaps / open candidates

- Franchisee revenue share computed but not paid through the payout ledger (no franchiseeId on AffiliatePayout); no geo-auto-assignment of orgs to territories; no franchisee portal.
- Real SMTP transport still stubbed (console/webhook mailer).
- Open ideas list lives near the end of `AGENTS.md` (OG images, autoresponder, notification bell, etc.).

## Key files map

```
prisma/schema.prisma              # whole SaaS commerce schema
lib/pricing/{catalog,countries,currencies,db,snapshot}.ts   # storefront catalog + PricingDoc
lib/saas/pricingSync.ts           # CANONICAL country-price writer (+tests)
lib/saas/planSync.ts              # approval workflow engine (+tests)
lib/saas/plans.ts subscriptions.ts organizations.ts billing.ts
lib/saas/{affiliates,partners,franchise,commissions,payouts}.ts
app/api/saas/**                   # control-plane APIs (plans, plan-prices, plan-requests,
                                  #   subscriptions, system-settings, franchise/*, ...)
components/saas/{CountryPricingMatrix,SubscriptionsManager,AffiliatesManager,
                  PartnersManager,FranchiseManager}.tsx
scripts/{verify-pricing-reqs,check-baseline}.ts             # live scenario verifiers
docs/DEPLOY-SAAS.md               # server env, self-provisioning, crons, rollback
AGENTS.md                         # historical phase log (very detailed)
```
