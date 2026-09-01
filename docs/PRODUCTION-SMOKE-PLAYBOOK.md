# PRODUCTION SMOKE PLAYBOOK — HospiOS SaaS Management App

**Release:** `9eefac5` · For the **deployment owner with Hostinger access**. This playbook cannot be
run from the repo workspace (no host access). Do **NOT** mark a result PASS until actually observed.

## 1. Canonical health contract

### Public liveness — `GET /api/health` (canonical)
- `GET https://thebuddharice.online/api/health`
- Expected: **`200`** with `{ "ok": true, "app": "ok", "db": "up", "time": "<ISO>" }`
- If DB down: **`503`** `{ ok:false, app:"ok", db:"down" }` → STOP, investigate.
- Never returns secrets/connection details.

### SaaS health (authenticated) — `GET /api/saas/health`
- Needs `CUSTOMER_VIEW` permission. `POST` (recompute) needs `CUSTOMER_MANAGE`. Not an uptime probe.

## 2. What to verify after deploy (minimal launch gate)
| Check | Command / URL | Expected |
|-------|---------------|----------|
| Migrations applied | (via `npm run start`) `prisma migrate deploy` | exit 0; 23 applied |
| Public health | `GET /api/health` | 200, `db:"up"` |
| Auth | login at `/account` with a real operator account | session created |
| SaaS boot | `GET /saas` (super_admin) | renders; no generic Control-Plane error |
| DB integrity | `GET /api/saas/metrics` | numeric KPIs (smoke check) |
| Cron auth | POST each cron with wrong secret header | 401 (`{"error":...}`) |

## 3. Full Phase 34/36/37 smoke surface (deployment owner fills in)
Use `docs/PRODUCTION-SMOKE-RESULTS.md` — do not record PASS without observing it.

| Area | Routes | Auth | Check |
|------|--------|------|-------|
| Public | `/`, `/pricing`, `/platform/*`, `/resources/*`, `/contact`, `/score-check`, `/free-score`, legal, 404 | A | direct load + navigation + mobile (320–1280) |
| Account/Auth | `/account` (in/out/reset), session expiry, unauthorized/forbidden | A/M | flows |
| SaaS | `/saas`, organizations, subscriptions, plans, billing, settings, settings/payments, claims, financial-approvals, audit | S/F | direct + navigation + refresh; watch generic Control-Plane error |
| Customer | `/customer`, billing, subscription, onboarding, support | C | tenant isolation |
| Marketing | `/marketing-admin`, `/account/leads` | K | JSON plane intact; CSV export |
| Affiliate/Partner/Franchise | affiliate routes, partner portal | K/C | payout = visibility only |

## 4. Critical negative checks
- **Security smoke (Phase 31):** CSRF (POST without origin rejected where enforced), IDOR (cross-org access rejected), RBAC (role→perm), tenant isolation, webhook (invalid signature/malformed rejected).
- **Secret exposure (Phase 32):** grep browser responses / HTML / bundles / error pages / logs for
  `DATABASE_URL`, `PAYMENT_ENC_KEY`, API/provider keys, SMTP password, `CRON_SECRET` — none may appear.
- **Error observability (Phase 33):** classify runtime log errors ERROR/WARNING/EXPECTED; any NEW
  critical error → STOP.
- **No real payment (Phase 22):** never charge/refund/payout real money during smoke.

## 5. Monitoring (Phase 42)
- Register an **external uptime monitor** on `GET /api/health` (alert on 503) — Hostinger monitoring
  and/or an external service. Do not expose internal diagnostics publicly.
