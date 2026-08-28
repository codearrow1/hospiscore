# Production Database Backup Plan

Backup and recovery plan for the production data on the hPanel / Hostinger host
(domain `https://thebuddharice.online`). This is a repository-side plan; the
scheduled execution is performed on the host at deploy time.

## Data sources that must be backed up

| Source | Backend | Location | Risk if lost |
| --- | --- | --- | --- |
| SaaS control plane | Prisma + SQLite (`DATABASE_URL`) | `var/saas.db` | Subscriptions, orgs, invoices, payments, approvals, audit log, analytics |
| Owner accounts / sessions / saved properties | JSON (`APP_DATA_FILE`) | `<project>/var/data.json` | Auth users, saved properties, score history |
| Provider secrets registry | AES-256-GCM encrypted, `APP_DATA_MIRROR` base | JSON behind `APP_DATA_FILE` / mirror | Payment gateway credentials (must re-enter if lost) |
| Uploaded / seeded content | Files | `app/data`, `public`, `var/` | Static + marketing data |

> `var/` (containing the SQLite DB and data JSON) is intentionally **excluded
> from deploys** (see `.gitignore`) but **must be included in the backup
> routine**. Do not gitignore it away from backups.

## Backup strategy

1. **Frequency**: at minimum a nightly snapshot; more often (hourly) is
   recommended for `var/saas.db` given transactional SaaS data.
2. **SQLite-safe snapshot**: use `sqlite3 var/saas.db ".backup 'backup/saas.db'"`
   (online, safe) rather than copying the live file, which can be mid-write.
   Then copy `backup/saas.db` to durable storage.
3. **JSON data**: copy `var/data.json` and the `APP_DATA_MIRROR` target.
4. **Secrets**: because gateway secrets are encrypted with `PAYMENT_ENC_KEY`,
   store a copy of `PAYMENT_ENC_KEY` (and `APP_DATA_MIRROR`) offline. Without
   the key, encrypted provider secrets cannot be recovered.
5. **Retention**: keep daily backups for N days plus a monthly sentinel.
6. **Off-site**: keep at least one copy off the web host (object storage, FTP
   to a separate host, or a local download) so a full host loss is survivable.

## Recommended schedule (host cron example)

```
# nightly at 02:10 host time
10 2 * * *  cd /path/to/project && /usr/bin/sqlite3 var/saas.db ".backup 'backups/saas-$(date +\%F).db'" && gzip -9 backups/saas-$(date +\%F).db && cp var/data.json backups/data-$(date +\%F).json
```

Normalize the path/dates to the hPanel cron environment and add retention
pruning. Reference `docs/CHECK-and-backup` conventions in the runbook.

## Restore / DR

- SQLite: stop writes (or accept the last committed point), replace
  `var/saas.db` with the snapshot, run `prisma migrate deploy` (migrations are
  additive/idempotent so restoring an older schema then migrating up is safe).
- JSON data: restore `var/data.json` (and the mirror target).
- Provider secrets: restore `APP_DATA_FILE` mirror, ensure `PAYMENT_ENC_KEY`
  matches the value used when the secrets were encrypted; otherwise re-enter
  credentials in Settings → Payments.
- Re-run `npm run launch:check` and verify the control plane boots
  (`prisma migrate status` clean) before opening traffic.

## Verification

- `npm run launch:check` prints `prisma migrate status` (migration diff
  readable) and `start command wiring`. Live restore drills are a host action
  and are `NOT VERIFIED` repo-side.
- Before every release, confirm a recent backup exists and a restore onto a
  scratch DB succeeds.
