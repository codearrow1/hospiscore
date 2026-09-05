# HospiOS Growth

The marketing / growth / conversion-center context. Owns the sales pipeline, leads, demos, report requests, campaigns, forms, page events, and conversion attribution. Logically separated from the operational PMS and from the SaaS commerce plane (`lib/saas/**`). A lead becomes a customer only through explicit conversion that preserves attribution (`ConvertedCustomer`).

## Language

**Lead**:
A prospective hospitality business captured into the growth pipeline (via a form, score check, or manual add), tracked through a sales pipeline to win/lost. Distinguished from a SaaS `Customer`/`Organization` until explicit conversion.
_Avoid_: prospect (generic), contact (a person, different concept), account

**Pipeline stage**:
The ordered lifecycle position of a lead on the kanban: `new`, `qualified`, `contacted`, `demo_booked`, `demo_completed`, `trial`, `proposal`, `negotiation`, `won`, `lost`. `won`/`lost` are terminal outcomes (re-open allowed to `new`/`qualified`).
_Avoid_: status (a form/request status, different concept)

**Demo**:
A booked product demonstration request associated with a lead source. Distinct from a `Lead`; tracked in its own collection (`DemoBooking`/`demoRequests`).
_Avoid_: booking, request (generic)

**Report request**:
A request for a generated property score report, sourced from the score lead-magnet (`/free-score`, `/score-check`, `ReportEmailForm`). Distinct from lead and demo.
_Avoid_: report (the artifact, not the request)

**Lead source**:
How a lead originated (organic, google_ads, meta_ads, linkedin, etc.), with structured attribution (`LeadSourceAttribution`).
_Avoid_: channel (loose)

**Conversion**:
The explicit, attribution-preserving transition from `Lead` to `ConvertedCustomer` (then to a SaaS `Organization`).
_Avoid_: upgrade, signup (vague)

**AffiliateCommission.leadId**:
Cross-context reference from a commission (SaaS commerce) back to the marketing `Lead` that created it.

## Decisions (grill-with-docs session)

- The growth pipeline (leads, demos, report requests) will be promoted from the JSON DataFile (`var/data.json`) into first-class Prisma models; Prisma becomes their source of truth, and the DataFile marketing arrays are retired. The "keep DataFile intact" rule (schema.prisma:3) is scoped to protecting the SaaS commerce plane, not to keeping marketing collections in JSON. → ADR-0001
- Transition uses a one-time backfill migration (stable `legacyId`) plus a short-lived dual-write so `AffiliateCommission.leadId` keeps resolving during deploy.
- `AffiliateCommission.leadId` becomes a real FK to the new `MarketingLead` (id migrated via the legacy map); a `legacyLeadId String?` column keeps history. → ADR-0002
- Public route contracts (`/api/marketing/leads`, `/api/demo`, `/api/leads/**`, `/api/report`) remain stable; implementation repoints transactionally to the new models.
- Entities are **separate tables**: `MarketingLead` (pipeline record), `DemoBooking` (demos), `ReportRequest` (score-report requests), `ConvertedCustomer` (attribution bridge); `LeadEvent` is a related child table of `MarketingLead`. Page-view/marketing analytics stay in the DataFile (out of scope).
- Stage/status remain **controlled `String` columns** with in-code `canMove`/`isLostReason` validation — no native DB enums (consistent with repo convention).
- Dual-write is gated by a `FeatureFlag` (`growth.persist.prisma`); cut-over to Prisma-only happens when route contracts return identical data from Prisma in tests.

## Design tree

- Q1 Idea confirmed: promote growth pipeline → Prisma (not RBAC-from-schema yet).
- Q2 Source of truth: **move** to Prisma, retire DataFile marketing arrays (protect only the commerce plane).
- Q3 Transition: backfill + short-lived dual-write.
- Q4 leadId: rename to real FK, keep `legacyLeadId`.
- Q5 API: keep contracts stable, repoint under the hood.
- Q6 Entities: separate tables (`MarketingLead`, `DemoBooking`, `ReportRequest`, `ConvertedCustomer`), shared source/attribution link.
- Q7 Representation: String stage/status + in-code validation (no DB enums).
- Q8 History: promote `LeadEvent` + `ConvertedCustomer`; leave page-view analytics in DataFile.
- Q9 Cut-over: FeatureFlag dual-write → flip to Prisma-only when tests prove parity.
- Q10 Backfill: legacy uuid → `legacyLeadId`; fresh cuid ids; rewrite `AffiliateCommission.leadId`; add `legacyLeadId String?` to commission.
- Q11 Dedupe: **application-level** `findExisting` (email→phone→domain), non-unique index on `email`; no hard unique constraint.
- Q12 Attribution: **denormalized** source/attribution columns on `MarketingLead`; `DemoBooking`/`ReportRequest` point back via `sourceId` to a lead where one exists; no normalization table.
- Q13 Conversion: lead **retained** (stage→won, `convertedAt` + `convertedCustomerId`), `ConvertedCustomer` has `leadId` back; never delete the lead (preserves history + commission link).
- Q14 Atomicity: group lead + events (+ conversion + commission-link) writes inside `prisma.$transaction` (DB is SQLite, supports transactions).
- Q15 Timeline: **three checkpoints** — (1) schema+models+rw behind flag; (2) backfill + parity tests; (3) flip flag→Prisma-only, retire DataFile arrays + flag + dead code. Reversible up to the id rewrite.
- Q16 Field surface: Prisma `MarketingLead` **mirrors the current interface 1:1** plus migration-added columns (`legacyLeadId`, `convertedAt`, `convertedCustomerId` FK); no new product fields in this change.
- Q17 Reader repointing: **swap only the data layer** behind existing function signatures (`listLeads`, `upsertLead`, `submitDemoRequest`, etc.); routes/callers unchanged; commission rewrite handled by migration, not runtime.
- Q18 Rollback bar (irreversible point): pre-flight parity test — (a) row counts, (b) every legacy `AffiliateCommission.leadId` resolves to exactly one backfilled `MarketingLead`, (c) dry-run ID map — before the production migration rewrites FKs.
- Q19 ✅ **Grilling closed: shared understanding reached. Design fully captured. No implementation written (that's the to-spec/to-tickets/dispatch phases).**

## Relationships

- **Lead ─ Demo**: a lead may be associated with one or more demos; a demo implies a lead-source.
- **Lead ─ ReportRequest**: a report request may originate from a lead source.
- **Lead ─ ConvertedCustomer**: a converted lead becomes a `ConvertedCustomer` (preserving attribution), and then a SaaS `Organization`.
- **Lead ─ AffiliateCommission**: a won/converted lead may earn an affiliate commission that references it via `leadId`.
