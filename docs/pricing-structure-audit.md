# Pricing Structure Audit — Marketing Pricing vs SaaS Plans

**Date:** 2026-08-22 · **Method:** read-only extraction from code, local DB (`C:\Temp\saas.db`), production DB via API (`thebuddharice.online`), and the live pricing data files. No names assumed.

## 1. Marketing Admin Pricing (catalog authority)

Code-defined catalog — `lib/pricing/catalog.ts` (5 plans, display order):

| id (slug) | Name | Rooms | Admins | Staff | Featured | CTA |
|---|---|---|---|---|---|---|
| solopreneur | Solopreneur | 1–6 | 1 | 5 | no | Book a demo |
| starter | Starter | 7–15 | 2 | 10 | no | Book a demo |
| growth | Growth | 16–40 | 5 | 25 | **yes** | Book a demo |
| professional | Professional | 41–100 | 10 | 75 | no | Book a demo |
| enterprise | Enterprise | 101–∞ | ∞ | ∞ | no | Talk to Sales |

Each entry also carries `tagline`, `descriptor`, `cardFeatures[]`, and the shared
`FEATURE_MATRIX`. Prices are NOT in code — they live in the PricingDoc data file:

- **16 country profiles**: US IN GB CA AU DE FR AE SG NP BD PK LK NG KE ZA
- Prices in **local currency units** (49 = "$49/month", 999 = ₹999/month), NOT cents
- `annual = 10 × monthly`; per-country tax profile + payment gateways
- **enterprise = {0, 0} everywhere** → "Contact us" custom pricing
- Local file: version 4 · Production file: version 2

US/IN sample (units): US solo 49/490, starter 89/890*, growth 179/1790, pro 299/2990*; IN solo 999/9990, starter 1999/19990, growth 3999/39990, pro 6999/69990.

### Data corruption found (pre-existing)

The previous baseline sync wrote SaaS billing **cents** into the storefront's
**unit-scale** US profile after approvals:

| Cell | Should be | Local actually | Prod actually |
|---|---|---|---|
| US.starter | 89/890 | 3600/49000 ❌ | 4900/44000 ❌ |
| US.professional | 299/2990 | 9900/99000 ❌ | 299/2990 ✓ |

Deterministic repair required before seeding canonical country prices.

## 2. SaaS Plans (Prisma `Plan`, billing authority today)

USD **cents**, single global price, no country dimension:

| slug | name | monthly¢ | annual¢ | maxProps | maxUsers | storageGb | features Json | active | ver (local/prod) |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| starter | Starter | 3800/4900 | 49000/44000 | 1 | 3 | 5 | reports,api,marketing | yes | 4 / 2 |
| professional | Professional | 9900 | 99000 | 5 | 15 | 20 | reports,api,marketing | yes | 1 / 1 |
| business | Business | 19900 | 199000 | 20 | 50 | 100 | …+automation | yes | 1 / 1 |
| enterprise | Enterprise | 49900 | 499000 | null | null | null | …+prioritySupport | yes | 1 / 1 |

Subscription references (local): starter 7 · professional 2 · business 2 · enterprise 2 — **all four plans are FK-referenced; deletion is impossible without destroying history.**

## 3. Comparison

| Marketing plan | Mktg slug | SaaS plan | SaaS slug | Monthly (storefront units) | Annual | Currency | Features | Limits | Status | Match |
|---|---|---|---|---:|---:|---|---|---|---|---|
| Solopreneur | solopreneur | — | — | 49 (US) | 490 | per-country | cardFeatures | rooms1–6/adm1/stf5 | active mktg | **B: missing in SaaS** |
| Starter | starter | Starter | starter | 89 (US) | 890 | per-country | cardFeatures vs Json flags | rooms7–15 vs props1/users3 | both active | **D+E+F: price scale & limits differ** |
| Growth | growth | — | — | 179 (US) | 1790 | per-country | cardFeatures | rooms16–40/adm5/stf25 | active mktg | **B: missing in SaaS** |
| Professional | professional | Professional | professional | 299 (US) | 2990 | per-country | differ | rooms41–100 vs props5/users15 | both active | **D+E** |
| Enterprise | enterprise | Enterprise | enterprise | 0/0 custom | — | — | custom semantics | unlimited | both active | **E partially (custom not represented)** |
| — | — | Business | business | $199/mo¢ | — | USD | Json flags | props20/users50 | **active in SaaS only** | **C: SaaS-only, obsolete** |

### Findings

- **A. Matching:** none exactly. Slug/name overlap exists for starter/professional/enterprise but price scale (units vs cents), limits semantics and feature vocabulary all differ.
- **B. Marketing-only (missing in SaaS):** `solopreneur`, `growth`.
- **C. SaaS-only (obsolete, still active):** `business`.
- **D. Price mismatches:** every overlapping plan — SaaS stores cents of an unrelated price point; storefront stores unit-scale local prices.
- **E. Feature/limit mismatches:** SaaS `{reports,api,marketing,…}` boolean flags and `maxProperties/maxUsers/maxBookings/storageGb` do not represent marketing's room bands or admin/staff limits.
- **F. Identity:** the only stable cross-catalog identity was the `PlanLink` table (starter/professional/enterprise linked; solopreneur/growth unlinked) — a duplicate identity layer that must be folded into `Plan` itself.
- **G. Country pricing:** SaaS has **no country/currency dimension at all** — structural gap. Storefront has 16 markets.
- **H. Structural:** two independent active catalogs (4 SaaS vs 5 marketing); unit-scale ambiguity caused real data corruption on the US baseline; enterprise "contact sales" semantics unrepresentable in the old schema.

## 4. Recommended migration (implemented in this branch)

Canonical source of truth = **Marketing catalog ids** carried directly on `Plan.marketingPlanId` (unique). `PlanLink` table is dropped.

| Existing SaaS plan | Classification | Action |
|---|---|---|
| starter | MAP + UPDATE | attach `marketingPlanId="starter"`, align billing price to US storefront ×100 ($89→8900¢), add rooms/admins/staff/order/features |
| professional | MAP + UPDATE | same ($299→29900¢) |
| enterprise | MAP + UPDATE | `isCustomPrice=true`, numeric prices → 0, unlimited limits, "Talk to Sales" |
| business | ARCHIVE | `isActive=false` + `archivedAt=now()`; FK history preserved; documented internal/archived exception |
| solopreneur | CREATE NEW | full commercial definition + country prices from PricingDoc |
| growth | CREATE NEW | same |

New child table **`PlanCountryPrice`** (`planId, country, currency, monthly, annual` in storefront units, unique per plan+country) gives SaaS Plans the same 16-market localized structure as the storefront. Billing keeps `Plan.monthlyPrice/annualPrice` as USD cents for `computeMrr`/invoices; the US row ×100 must equal those cents (invariant enforced by the reconcile service).

Approval workflow gains structural actions (`create|update|archive|activate|deactivate`) with the whitelist extended to all new commercial fields; financial tables remain structurally unreachable.

## 5. Implementation status — DONE & verified locally (2026-08-22)

- Migration `20260822140000_plan_catalog_structure`: `PlanLink` dropped,
  `Plan.marketingPlanId` (unique) + commercial columns added,
  `PlanCountryPrice` created, `PlanChangeRequest.action` + nullable
  `planId`.
- Services: `lib/saas/planCatalog.ts`
  (`buildCatalogPlanInputs`, `auditPricingPlanSync`, `reconcilePlans`,
  `looksLikeCentContamination`) and rewritten `lib/saas/planSync.ts`
  (structural actions, 21-field whitelist, create support).
- APIs: `/api/saas/plan-sync` GET=audit / POST=reconcile (`{"apply":true}`
  applies, otherwise dry run), `/api/saas/plan-sync/audit`,
  plan CRUD passes new fields and DELETE now **archives**.
- Local E2E reconcile result: 8 deterministic actions
  (`REPAIR×2` US.starter 3600→89/890, US.professional 9900→299/2990;
  `CREATE` solopreneur + growth; `UPDATE` starter/professional/enterprise;
  `ARCHIVE` business with its 2 subscriptions preserved) → post-audit
  `ok:true`, all 5 catalog plans matched, 16 country prices each,
  dry-run re-run reports 0 actions (idempotent).
- Tests: `lib/saas/planSync.test.ts` (22) cover settings coercion,
  whitelist purity, snapshot/diff/patch round-trip incl. structural
  fields, staleness/self-approval, tier matrix, catalog derivation
  ($49/$89/$179/$299 → 4900/8900/17900/29900¢), contamination detector,
  baseline invariant. Full suite: 25 files / 244 tests green;
  typecheck + eslint clean.

