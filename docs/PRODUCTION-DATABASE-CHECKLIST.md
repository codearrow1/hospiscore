# PRODUCTION DATABASE CHECKLIST — HospiOS SaaS Management App

**Release:** `9eefac5` · **SaaS plane:** Prisma + SQLite · **JSON plane:** `var/data.json` + `var/scores/`

Repository-side deterministic sequence. Every step that touches the live host is marked
**HOST ACTION**. Do **NOT** run destructive commands automatically; prefer `prisma migrate deploy`.

---
## Preconditions (HOST ACTION)
1. **Durable `DATABASE_URL`** — set to a SQLite file path **without spaces**, e.g.
   `file:/home/<user>/hospios/var/saas.db`. Confirm the directory exists, is writable by the app
   user, and **persists across deploys/restarts**. (Never the dev `file:C:/Temp/saas.db`.)
2. **Existing backup (if a DB already exists)** — see `PRODUCTION_DATABASE_BACKUP.md`. No overwrite.
3. Deploy the exact release `9eefac5` (do not deploy unverified commits).

## Sequence
| # | Step | Command / action | Destructive? | Host? |
|---|------|------------------|--------------|-------|
| 1 | Configure `DATABASE_URL` (durable, no spaces) | hPanel env | No | Yes |
| 2 | Backup existing prod DB if any | `.backup` to a timestamped path | No | Yes |
| 3 | Deploy release `9eefac5` | GitHub → Hostinger build | No | Yes |
| 4 | Apply migrations | `npm run start` auto-runs `prisma migrate deploy`; or `npx prisma migrate deploy` | **Yes (schema change; additive only)** | Yes |
| 5 | Verify migration table | `_prisma_migrations` exists with all 23 applied exactly once | read | Yes |
| 6 | Verify schema | `npx prisma validate`; check `Invoice`/`Payment.idempotencyKey` present | read | Yes |
| 7 | Verify app connectivity | app boots; sign in to `/saas` | No | Yes |
| 8 | Verify health endpoint | `GET /api/health` → `200 {ok:true, db:"up"}` | read | Yes |
| 9 | Run smoke tests | `npm run smoke` (16/16 repo-side; re-run on host) | read/write test data | Yes |

## Migration posture (from repo audit)
- **23 migrations**, monotonic order, sqlite provider. All additive DDL (add columns/indexes/tables);
  no data backfill, no table recreation — rollback = revert the deploy / ignore the sqlite file.
- **Latest:** `20260829010000_caller_idempotency_key` adds nullable `@unique idempotencyKey` to
  `Invoice` + `Payment` (NULL distinct in SQLite ⇒ legacy/external rows unaffected). Matches schema.
- **Self-provisioning:** app creates the DB dir and replays migrations on first SaaS access; no Prisma
  CLI required on the server (`DEPLOY-SAAS.md` §2).

## Rollback considerations
- **SaaS plane:** revert the deploy commit; `next start` keeps working because the JSON plane owns all
  pre-existing features. The sqlite file simply stops being read.
- **JSON plane:** unchanged by SaaS deploys; `APP_DATA_MIRROR` (~/.hospiscore/data.json) auto-recovers
  the document if the host wipes `var/`.
- Only roll back for real production-critical failures (see rollback criteria), never cosmetic UI.

## Do NOT
- Run `prisma db push` against production (unless explicitly required and proven safe).
- Reset/delete the production sqlite file.
- Point `DATABASE_URL` at a temp path.
