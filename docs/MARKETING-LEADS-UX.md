# Marketing Leads UX — design & conventions

This document describes the `/marketing-admin/leads` workspace and the shared
view-model that powers it. It exists so future edits stay consistent with the
"no fabricated data" rule and the established URL-driven architecture.

## Architecture

The leads page is **server-rendered and URL-driven**. Every filter, sort, and
pagination choice round-trips the URL (`?q=&stage=&source=&country=&plan=&band=&owner=&sort=&dir=&page=&perPage=`),
so a filtered view is shareable, bookmarkable, and cached-safe. The page:

1. Guards access with `requireCapability("leads.read")`.
2. Loads all leads, users, demo bookings, and converted customers.
3. **Hard-scopes non-managers** (no `leads.manage`) to their own assignments —
   `?owner=` cannot widen the view, mirroring `GET /api/marketing/leads` and
   the pipeline board.
4. Applies URL filters/sort/page server-side (never ships the whole store to
   the browser; matches existing performance constraints).
5. Enriches the *filtered* set with `buildLeadRows(...)` so KPI cards, funnel,
   and per-currency open value reflect the current filtered view, then pages.

### Client orchestration

`LeadsTableClient.tsx` is a thin orchestrator:

- `PageHeader` — title, mission statement, `+ New lead` / `Export CSV`.
- `LeadsKpis` / `FunnelStrip` — real numbers from `leadsKpis` / `funnelOf`.
- `LeadFilters` — `FilterSheet` drawer (local draft state applying on one
  `router.push`) + removable active-filter chips. Deliberately loop-safe: no
  effect synchronizes router → draft.
- `SavedViews` — localStorage saved views with sensible defaults, rename via
  re-save, set-as-default, delete.
- Table with property-first hierarchy, stage/demo/priority badges, quality
  badges, sticky-ish sortable columns, per-column hide/show (localStorage),
  mobile cards, bulk stage/owner/delete bar, real range pagination.

## The view-model (`lib/marketing/leadsView.ts`)

Pure, side-effect-free, imported by both the SSR page and the detail page
(`app/marketing-admin/leads/[id]/page.tsx`). It derives **only** signals that
are backed by real stored data:

| Signal | Source (real field) | Never inferred? |
| --- | --- | --- |
| `stale` | `updatedAt`/`createdAt`/`lastContactAt` ≥ 14 days | — |
| `followUpStatus` | `nextFollowUpAt` actual date | missing date → `none` |
| `dealAgeDays` | `createdAt` | — |
| `daysInStage` | `updatedAt` | — |
| `demoStatus` | newest `DemoBooking` for the lead (`leadId`) or `demoId` | missing → `none` |
| `converted` | `convertedCustomerId` or a matching `ConvertedCustomer.leadId` | missing → false |
| quality flags | missing email / phone / property+company / source / owner / next step | — |
| KPI/funnel/open-value | counted over the filtered `LeadRow[]` | — |

Money is always formatted via `lib/format.ts` `formatMoney` (minor units) and
**never merged across currencies** (`openValueByCurrency`).

## Rules for future edits

1. **No fabricated KPIs/activity/scores/revenue.** If the store lacks the data,
   show an em dash / `none` and mark the capability as FUTURE in the UI — do
   not invent a score, weight, or revenue number.
2. **Keep the view-model pure.** New derived fields go in `leadsView.ts` with
   a vitest case in `leadsView.test.ts`.
3. **Stay URL-driven.** New filters must merge into the query string through
   the `href` helper on the server; client-side adversity (column visibility,
   saved views, selection) belongs in `localStorage`, not the URL.
4. **Preserve the sales-rep hard scope.** Any new data path (export, KPI,
   drawer) must scope non-managers to `ownerEmail`.
5. **Loop-safety.** Apply-by-click for drawers; never sync `useEffect` ↔
   router for filter state.
6. Run the gates after any change: `npx tsc --noEmit`, `npm run lint`,
   `npx vitest run`, `npm run build`, `npm run launch:check`, `npm run smoke`.

## Gates

See `package.json`. `SMOKE RESULT: PASS (16/16)` and `launch:check` PASS are
required before deployment. The two integration-test flakes (Prisma SQLite
socket timeout in `idempotency.test.ts` and `subscription-selfservice.test.ts`)
are environmental and pass when run per-file.