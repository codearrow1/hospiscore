# Promote the growth pipeline from the JSON DataFile to Prisma

The marketing growth pipeline (leads, demos, report requests, and conversion)
lives in `var/data.json` (`leads[]`, `demoRequests[]`, `reportRequests[]`),
referenced cross-context by `AffiliateCommission.leadId`. The schema comment at
`prisma/schema.prisma:3` says "Keep marketing DataFile intact", which reads as a
reason not to move it. We decided to **move** the growth pipeline into
first-class Prisma models (`MarketingLead`, `DemoBooking`, `ReportRequest`,
`ConvertedCustomer`, `LeadEvent`), making Prisma the source of truth and
retiring the DataFile marketing arrays, because the growth pipeline is
transactional business data that needs relational integrity, querying, and
durability — and the "keep DataFile intact" rule was only ever about protecting
the SaaS commerce plane from cross-writes, which keeping the commerce tables
separate satisfies.

The unavoidable trade-off: a one-time backfill + dual-write transition, and a
departure from the literal "marketing stays in JSON" comment. This is hard to
reverse once data is migrated, and surprising (it contradicts the visible
comment), so it's recorded.
