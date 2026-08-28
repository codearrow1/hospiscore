# Production Runbook

Operational runbook for operating HospiOS on the hPanel / Hostinger host
(`https://thebuddharice.online`). Repository-side guidance; live host shell
actions are `NOT VERIFIED` here.

## 1. Identity, roles, escalation

- **RBAC**: marketing roles (`lib/marketing/roles.ts`), SaaS roles
  (`lib/saas/roles.ts`). `super_admin` is the top tier. Four-eyes approval gates
  protect financial operations.
- **Escalation path**: a `super_admin` account is required to assign the
  `super_admin` role, change another admin's role, or run control-plane
  diagnostics. Anyone with `SYSTEM_SETTINGS_MANAGE` can manage SaaS users.
- If you cannot perform an action, confirm your role tier first; do not share
  `super_admin` credentials.

## 2. Daily / shift ops

- **Control plane**: run `npm run launch:check` after any deploy; monitor the
  `## Database startup` and `## Payment provider integrity` sections.
- **Cron**: dunning + automation endpoints require `CRON_SECRET`
  (`X-Cron-Secret` header). Confirm the scheduler sends it. `AFFILIATE_CRON_KEY`
  protects the affiliate cron.
- **Alerts**: `npm run alerts` emits the weekly digest (or sends via
  `ALERT_WEBHOOK_URL`).

## 3. Boot / deploy

- Build: `npm run build` (`prisma generate` → `fix-prisma-runtime` → `next build`).
- Start: `npm run start` runs `prisma migrate deploy && next start`. The
  pending `20260828020000_financial_approvals` migration is additive and
  idempotent; it applies automatically at startup.
- `PRISMA_QUERY_ENGINE_LIBRARY` and the tracked vendored engine
  (`vendor/engines/...`) let Prisma run on hosts that lack `lib/generated`.
- hPanel may not ship `lib/generated`; the runtime fix scripts handle this.

## 4. Payments

- Provider credentials are entered in **Settings → Payments** and stored
  AES-256-GCM encrypted with the key derived from `PAYMENT_ENC_KEY`.
- A provider must reach **`ready`** via a successful live connection test
  before it can route real payments. Do **not** rush a provider to ready
  without a verified sandbox flow.
- Webhook prod-readiness is documented in `docs/PAYMENT_WEBHOOKS.md`.
- **Do not** run demo seeding in production. `ALLOW_DEMO_SEED` must be `0`.

## 5. Investigation (recurring issues)

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `launch:check` shows `routable providers` FAIL | A provider reached `ready` unintentionally | Set it back to `registered`/disable; do not ship a live provider. |
| Control-plane diagnostics 403 | Caller lacks `SYSTEM_SETTINGS_MANAGE` | Authenticate as `super_admin`. |
| Webhook returns 400 `Verification failed` | Signature mismatch / tampering | Re-check the gateway signing secret; investigate bursts. |
| `/account` pages loop to `404` | Route regression | Confirm redirects target `/account` (dead `/login` was removed). |
| Demo accounts appear in prod | `ALLOW_DEMO_SEED=1` was set | Set to `0`, rotate the demo accounts. |
| Encrypted provider secret fails to decrypt | `PAYMENT_ENC_KEY` mismatch/rotation | Restore the matching key or re-enter credentials. |

## 6. Support escalation matrix

- Billing/refund approval: only users with `FINANCIAL_APPROVE` /
  `REFUND_APPROVE` may advance these (four-eyes).
- Auth/session problems: check `APP_SESSION_COOKIE` / `APP_SESSION_DAYS` /
  `APP_DATA_FILE`.
- SaaS data integrity: `prisma migrate status`; restore per
  `docs/PRODUCTION_DATABASE_BACKUP.md`.

## 7. Incident response

1. Verify `launch:check` output; capture the failing section.
2. Confirm backups exist (`docs/PRODUCTION_DATABASE_BACKUP.md`).
3. Escalate to `super_admin`; do not log secrets (provider keys, `PAYMENT_ENC_KEY`).
4. After change, re-run `npm run launch:check` and confirm zero FAIL rows.
