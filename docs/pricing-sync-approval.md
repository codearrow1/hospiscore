# Pricing Sync + Approval Workflow

Single synchronized pricing/plan management between the Marketing Admin
localized pricing plane (`/marketing-admin/pricing`) and the SaaS control
plane (`/saas/plans`), with a Super Admin approval gate, audit trail and
financial-integrity guarantees.

## Architecture

> **Superseded (2026-08-22):** the `PlanLink` indirection was folded into
> `Plan.marketingPlanId` and the SaaS Plan table now mirrors the *full*
> Marketing catalog structure (5 plans, room bands, admin/staff seats,
> featured flag, display order, custom pricing, per-country storefront
> prices). See **docs/pricing-structure-audit.md** for the authoritative
> data model. The flow below remains accurate except that identity is a
> column, not a separate table.

```
canonical source of truth          localization / storefront layer
┌──────────────────────────────┐ sync  ┌──────────────────────────────┐
│ Prisma Plan (versioned)      │ ────► │ PricingDoc JSON (DataFile)   │
│ /saas/plans                  │       │ US baseline profile per plan │
│ marketingPlanId column       │       │ + PlanCountryPrice rows      │
│ = Marketing catalog id       │       │ country profiles stay local  │
└──────────────────────────────┘       └──────────────────────────────┘
            ▲                                  ▲
            │ propose (PlanChangeRequest)      │ full doc edits
            └── /marketing-admin/pricing ──────┘
```

- **Canonical billing prices** live in the `Plan` table. Every edit bumps
  `Plan.version`.
- **Marketing PricingDoc** (`lib/pricing/db.ts`) remains the localized
  storefront layer. The **US baseline** price point of each linked catalog id
  (`solopreneur|starter|growth|professional|enterprise`) is derived from the
  linked plan; other countries are never touched.
- `enterprise` is intentionally exempt from baseline sync — the storefront
  validation marks it custom-priced (`0/0` = "Contact us"). The drift report
  flags it with `custom: true` instead of treating it as an error.

## Approval workflow

Setting key: `require_marketing_pricing_approval` in table `SystemSetting`
(stored as `{ enabled: boolean }`). Default when unset: **enabled**
(financial safety first). Toggle at `/saas/settings` — Super Admin only,
audited.

| Approval setting | Marketing Admin submits | Result |
| --- | --- | --- |
| ON (default) | `POST /api/saas/plan-requests` | Request stored `pending` (HTTP 202). Nothing changes until a Super Admin approves. |
| OFF | same | Change applies immediately (still audited) and the baseline re-syncs. |

### Rules enforced server-side

- Only whitelisted fields can be proposed (`PROPOSABLE_FIELDS`: name,
  monthlyPrice, annualPrice, trialDays, maxProperties, maxUsers, maxBookings,
  storageGb, features, isActive). `slug` is never editable.
- **Self-approval blocked**: reviewer email must differ from requester
  (case/whitespace-insensitive).
- **Staleness**: a request stores `baseVersion`. If `plan.version` moved on
  before approval, approval is refused (HTTP 409) and the request is
  auto-rejected with `"Plan changed after this request was submitted."`
- Rejection requires a reason; requesters may cancel their own pending
  requests.
- Every submit/approve/reject/cancel/reconcile writes to the SaaS audit log.

## APIs

| Endpoint | Who | Purpose |
| --- | --- | --- |
| `GET/POST /api/saas/plan-requests` | any platform user (POST needs `pricing.manage`) | list (super sees all, others own) / propose |
| `POST /api/saas/plan-requests/[id]/approve` | Super Admin only | apply proposal, bump version, re-sync baseline |
| `POST /api/saas/plan-requests/[id]/reject` | Super Admin only | reject with required reason |
| `POST /api/saas/plan-requests/[id]/cancel` | requester only | withdraw pending request |
| `GET/PUT /api/saas/system-settings` | Super Admin only | read/toggle the approval requirement |
| `GET/POST /api/saas/plan-sync` | Super Admin only | drift report / reconcile baselines |

## Financial integrity

Invoices store an `amount` snapshot at creation, subscriptions store `mrr`,
and payments are immutable ledgers. The approval pipeline applies changes
exclusively through `updatePlan` with a whitelist-derived patch
(`patchFromDiff`), so **no historical invoice, payment or subscription row can
be rewritten by a pricing change** — existing customers keep their contracted
price until they explicitly change plans.

## UI

- `/saas/plans` — canonical plans CRUD (Super Admin); shows pending-approval
  banner per plan with a review link.
- `/saas/plan-approvals` — Super Admin queue: diffs (before → after),
  approve / reject-with-reason, status history.
- `/saas/settings` — approval toggle with description and disable warning.
- `/marketing-admin/pricing` — localized pricing editor plus a read-only
  "SaaS plan catalog" panel showing canonical values, labeled pending
  proposals, and a propose-change form.

## Demo data

`seedDemoMonth` seeds three example requests against the cheapest active plan
(self-guarded, runs even when the month demo already exists): one approved
price change, one rejected rename with reason, and one pending annual-price
proposal reviewers can act on for real.

## Tests

`lib/saas/planSync.test.ts` covers settings coercion defaults, the proposal
whitelist, snapshot/diff/apply roundtrip, financial-integrity patch keys,
staleness, self-approval identity matching, the super-tier security matrix and
the baseline-sync invariant (localization preserved, inputs not mutated).
