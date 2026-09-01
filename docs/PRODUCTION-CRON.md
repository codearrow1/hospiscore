# PRODUCTION CRON — Background Jobs Inventory & Hostinger Checklist — HospiOS

**Release:** `9eefac5` · All six endpoints require a shared-secret header (or session RBAC fallback).
Registration is a **HOST ACTION** in Hostinger → Advanced → Cron Jobs.

## Inventory

| Endpoint | Purpose | Method | Secret header | Frequency | Idempotency / failure behavior |
|----------|---------|--------|---------------|-----------|--------------------------------|
| `/api/saas/cron/dunning` | Process due payment retries | `POST` (session) / `GET` (secret-only) | `X-Cron-Secret: CRON_SECRET` | Daily | Transactional; retry-safe; GET refuses non-secret callers. |
| `/api/saas/cron/lifecycle` | Trial/renewal/usage/churn state machine (M-06), MRR sync | `POST` (session) / `GET` (secret-only) | `X-Cron-Secret: CRON_SECRET` | Daily | Idempotent per-subscription; illegal transitions skipped not forced; paged (200). |
| `/api/saas/cron/usage` | Invoices last month's overage; inert until `usage_overage_rates` configured | `POST` (session) / `GET` (secret-only) | `X-Cron-Secret: CRON_SECRET` | Monthly (period `YYYY-MM` opt) | Marker-based: duplicates prevented; mid-sweep failure un-sets marker so org retries. |
| `/api/saas/cron/automation` | Lifecycle/health rule sweep + event listing | `POST` / `GET` | `X-Cron-Secret: CRON_SECRET` (or MARKETING_MANAGE) | Daily | Sweep returns counts; rules idempotent. |
| `/api/saas/cron/affiliate-recurring` | Advance deferred commissions (100/batch) | `POST` | `X-Api-Key: AFFILIATE_CRON_KEY` | Daily | Batched; safe to re-run. |
| `/api/marketing/cron/followups` | Lead follow-up digest (list; `send=1` emails) | `GET` (secret-only send) / `POST` (session, origin-checked) | `X-Cron-Secret: CRON_SECRET` | Daily | Digest regenerated per run; send requires secret (GET) or same-origin session (POST). |

## Auth notes (verified in source)
- All secrets compared with constant-time `secretsMatch` (`lib/saas/cronAuth`, `node:crypto`).
- GET-with-side-effect is reserved for secret-bearing **external** schedulers; session callers must
  POST — a top-level cross-site navigation (SameSite=Lax) can never fire side effects while an admin
  browses. Unauthorized → `401`.
- Without the secret header, endpoints fall back to session auth (`BILLING_MANAGE` /
  `MARKETING_MANAGE` / `leads.read`) and return `401` to anonymous callers.

## Hostinger Cron checklist (HOST ACTION)
Wire these (stagger a few minutes; adjust times per plan; run once manually to confirm
`{"ok":true,…}` — never repeatedly for testing):

```cron
# Dunning — 03:10 daily
10 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/dunning >/dev/null

# Lifecycle — 03:25 daily
25 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/lifecycle >/dev/null

# Automation — 03:40 daily
40 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/automation >/dev/null

# Affiliate recurring — 03:55 daily
55 3 * * *  curl -fsS -X POST -H "X-Api-Key: <AFFILIATE_CRON_KEY>" https://thebuddharice.online/api/saas/cron/affiliate-recurring >/dev/null

# Usage billing — 1st of month 04:10 (only if usage_overage_rates configured)
10 4 1 * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/usage >/dev/null

# Marketing follow-up digest — 08:00 daily
0 8 * * *  curl -fsS -X GET -H "X-Cron-Secret: <CRON_SECRET>" "https://thebuddharice.online/api/marketing/cron/followups?send=1" >/dev/null
```

## Safety
`CRON_SECRET` and `AFFILIATE_CRON_KEY` must be high-entropy and match the values set in the host env.
If unset, scheduled jobs return 401 (safe default: nothing runs without the secret). The digest send is
secret-only on GET, so a stray browser navigation cannot emit mail.
