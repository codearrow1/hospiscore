# PRODUCTION OBSERVABILITY — HospiOS SaaS Management App

**Release:** `9eefac5` · Repository-side observability surface. Health/log/alert wiring is
**HOST-VERIFICATION-REQUIRED** after deploy (uptime pings, SMTP/webhook delivery, log retention).

## Health endpoints
| Endpoint | TLS | Auth | Success | Failure | Notes |
|----------|-----|------|---------|---------|-------|
| `GET /api/health` | public | none | `200 {ok,app:"ok",db:"up"}` | `503` when DB down | Canonical uptime probe; no secrets |
| `GET /api/saas/health` | SaaS | `CUSTOMER_VIEW` capability | `200` | `401/403` | Authed, deeper checks |

## Logging
- Next.js runtime logs on Hostinger deployment (VPS/Node). SaaS audit events are persisted
  (`lib/saas/audit.ts`, `writeSaasAudit`) — searchable, not just console.
- Cron runs, payment-webhook processing, dunning, and notifications log deterministic outcomes.

## Alerts (mailer transports — `lib/mailer.ts`)
| Transport | Trigger condition | Destination |
|-----------|-------------------|-------------|
| SMTP | `SMTP_HOST` + `SMTP_USER` set | `SMTP_TO`/`SMTP_FROM` |
| Webhook | `ALERT_WEBHOOK_URL` set (no SMTP) | webhook URL |
| Console | dev only | stdout |

Strict ordering; falls through to the next transport if the previous isn't configured.

## Monitoring contract (host must configure)
1. Uptime monitor on `GET /api/health` (external, ≥ every 5 min) — page `200` expected.
2. Alerts wired via `ALERT_WEBHOOK_URL` (Ops) and/or `SMTP_HOST`/`ALERT_*` (email).
3. On 503 (DB down): alert owner immediately; DB recovery per `PRODUCTION-DATABASE-CHECKLIST.md`.
4. Observe cron-job success/failure from the Hostinger cron log (see `PRODUCTION-CRON.md`).
5. Retain app/stdout logs for incident triage; do not log secrets.

## Guardrails
- **Never** log secrets, tokens, or customer PII in app/stdout.
- Do **not** expose `/api/saas/health` publicly; use public `/api/health` for uptime probes.
