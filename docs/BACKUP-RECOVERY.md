# PRODUCTION BACKUP & RECOVERY — HospiOS SaaS Management App

**Release:** `9eefac5` · Database = **SQLite** (`engine: "classic"`), file-backed by the app (mirror dir).

## Backup objective
SQLite is a **single-file** database. Production continuity requires **consistent, tested backups**
of the DB file (data) **plus** disk backups of uploads/attachments (if any) and env/config so a
machine can be recreated identically.

## Recommended backup procedure (host runs)
1. Determine the live DB file path (set by `DATABASE_URL` — likely the `APP_DATA_MIRROR` directory,
   e.g. `<mirror>/app.db`).
2. **Consistent snapshot** — never `COPY` a SQLite file while the app is actively writing. Prefer
   `sqlite3 <db> ".backup <backupname>.db"` (online backup API preserves consistency) or
   **pause/deploy-drain**. Do **not** use plain `cp` during writes.
3. Frequency: **daily** minimum; hourly if payment/transaction volume is high.
4. Retention: e.g. 7 daily + 4 weekly + 12 monthly, off-machine (different disk / object storage / host snapshot).
5. **Restore test** — restore to a scratch path and `PRAGMA integrity_check;` + run the smoke suite
   against it. Untested backups are not backups.
6. Env restore: keep a copy of the production `.env` (secrets) in the host's secure vault — the app
   cannot run without `DATABASE_URL`, `PAYMENT_ENC_KEY`, `APP_SESSION_COOKIE`.

## Recovery sequence (host)
1. Confirm the incident (run `GET /api/health` → expect 503 if DB down).
2. Restore the latest good backup to the live DB path (apply the drain first).
3. `PRAGMA integrity_check;` → expect `ok`.
4. Start app (`npm start` → runs `prisma migrate deploy && next start`). Migrations after the backup
   timestamp apply automatically; they are additive and safe (`20260829010000_caller_idempotency_key`
   is additive: ADD COLUMN + CREATE UNIQUE INDEX on nullable column).
5. Run the minimal smoke gate (health 200 + `db:"up"`) then the full `PRODUCTION-SMOKE-PLAYBOOK.md`.

## Do NOT
- `prisma db push` on production (use `migrate deploy`).
- Rotate `PAYMENT_ENC_KEY` after secrets are saved — encrypted data becomes undecryptable.
- Plain-`cp` a hot SQLite file and call it a backup.
- Store the only backup on the same disk/instance as the live DB.

## Data-machine separation
The DB lives in `APP_DATA_MIRROR` (persistent), kept separate from the ephemeral app dir so redeploys
don't wipe data. Confirm this separation is real on the host before relying on it.
