# Rewrite AffiliateCommission.leadId to a Prisma FK and keep legacyLeadId

`AffiliateCommission.leadId` (`schema.prisma:631`) currently holds a DataFile
marketing uuid as a bare string, with no relational integrity — a commission
could point at a deleted or never-existing lead. Now that leads move to Prisma,
we decided to make `leadId` a **real foreign key** to the new `MarketingLead`
table, store fresh Prisma `cuid` ids, migrate existing commission rows by
remapping the legacy uuid → new id, and add a separate `legacyLeadId String?`
column purely for historical traceability.

This is hard to reverse after the id rewrite (referential data is rewritten at
migration time) and is surprising (existing rows' visible `leadId` values
change), and it reflects a real trade-off between preserving the original id
(a pager/audit would match the old string) and gaining a proper FK. We chose the
FK for relational integrity, keeping the original as `legacyLeadId` for audits.

## Implementation notes (checkpoint 3)

- Migration `20260905000000_affiliate_lead_fk` rebuilds the table (SQLite has no
  `ALTER TABLE ... ADD CONSTRAINT`), remaps each `leadId` uuid → `MarketingLead.id`
  via `legacyLeadId`, keeps unmatched rows with a NULL `leadId` (uuid preserved in
  `legacyLeadId`), and enables the global `growth.persist.prisma` flag.
- Migrations are applied as raw SQL at boot (`lib/saas/init.ts`) and cannot read
  `var/data.json`, so the authoritative historical backfill runs in JS:
  `lib/growth/backfill.ts` upserts DataFile leads/conversions into the Prisma
  plane (keyed on `legacyLeadId`) and re-links any commission whose `leadId` was
  left NULL by the migration. It is invoked from `initSaasDb()` after migrations.
- `attributeLeadToAffiliate` now resolves the incoming DataFile uuid to the Prisma
  `MarketingLead.id` and stores `leadId` + `legacyLeadId`; a missing mirror row
  degrades to a NULL `leadId` with the uuid preserved, so attribution is never lost.
