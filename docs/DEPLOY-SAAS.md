# Production Deploy — SaaS Control Plane

Applies the Prisma-backed SaaS commerce plane alongside the existing JSON
data store (`var/data.json`, mirrored to `~/.hospiscore/data.json`). The two
planes are independent; deploying the SaaS plane does not touch marketing data.

## 1. Server environment

In the Hostinger app's environment settings (or `.env` next to the build):

```env
DATABASE_URL="file:./var/saas.db"
CRON_SECRET=<long random string>
SITE_URL=https://thebuddharice.online
```

Notes:
- `var/saas.db` lives outside git (`/var/` is ignored) so deploys never
  overwrite it. Back it up like `var/data.json`.
- If the absolute project path contains spaces, SQLite cannot open relative
  `file:` URLs — use an absolute path without spaces, e.g.
  `DATABASE_URL="file:/home/user/saas-data/saas.db"`.
- Dev convenience only: local dev uses `file:C:/Temp/saas.db` because the
  Windows project path has spaces. Do **not** copy that value to production.

## 2. Migrations

`npm start` now runs `prisma migrate deploy && next start`, so every boot
applies pending migrations before serving (fail-fast if the DB is missing or
locked). To migrate manually:

```bash
npm run db:migrate
```

## 3. Cron registration (Hostinger → Advanced → Cron Jobs)

Two daily jobs (stagger them a few minutes apart):

```cron
# Dunning — process due payment retries (03:10 daily)
10 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/dunning >/dev/null

# Lifecycle automation — trial/renewal/usage/churn sweeps (03:25 daily)
25 3 * * *  curl -fsS -X POST -H "X-Cron-Secret: <CRON_SECRET>" https://thebuddharice.online/api/saas/cron/automation >/dev/null
```

Without the header the endpoints fall back to session auth (BILLING_MANAGE /
MARKETING_MANAGE) and return 401 for anonymous callers — the secret is what
lets the scheduler in.

## 4. Post-deploy verification checklist

1. `GET /api/auth/me` still works; sign into `/marketing-admin` — leads,
   campaigns, forms intact (JSON plane untouched).
2. Sign into `/saas` — Command Center renders; plans seeded idempotently.
3. Mirror-restore drill (JSON plane): stop the app, delete/move
   `var/data.json`, start again, make any write (e.g. submit a form), confirm
   `var/data.json` reappears with prior users/campaigns restored from
   `~/.hospiscore/data.json`. Restore covered by unit tests as well
   (`lib/db.test.ts`).
4. SQLite plane: create a test organization + subscription; confirm
   `/api/saas/metrics` reflects it.
5. Crons: run both curl commands manually once — expect
   `{"ok":true,...}` JSON, not 401.

## Rollback

- SaaS plane: revert the deploy commit; `next start` without migrations keeps
  working because the JSON plane owns all pre-existing features. The sqlite
  file simply stops being read.
- JSON plane: unchanged by these deploys; mirror auto-recovers the document
  if the host wipes `var/`.
