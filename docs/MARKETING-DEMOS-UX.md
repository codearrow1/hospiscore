# Marketing admin — Demos workspace

The demos workspace (`/marketing-admin/demos`) replaces the old single-page
calendar with three views (week calendar, list, agenda) backed by a pure
view-model and a set of small client components. It connects to the same
booking API as before — nothing about the storage schema or the status
lifecycle changed.

## Component map

| File | Role |
| --- | --- |
| `app/marketing-admin/demos/page.tsx` | Server component. Guards the route, reads/validates URL params, loads + enriches rows, computes KPIs, filters/sorts/paginates, joins affiliate + lead events, and renders `<DemosWorkspace>`. |
| `lib/marketing/demosView.ts` | Pure view-model: row enrichment, period classification, follow-up urgency, KPI rollups, filtering, sorting, pagination, conflict detection. No DB/API imports — unit-testable. |
| `lib/marketing/demosView.test.ts` | 17 unit tests covering every derived rule and KPI. Anchored to a fixed clock (`2026-03-04 10:00` Wed) for determinism. |
| `components/marketing-admin/demos/DemosWorkspace.tsx` | Client orchestrator: header + book button, KPI strip, filter row, view toggle, week nav, per-view body, detail drawer + book modal. |
| `DemosKpis.tsx` | Eight `KpiCard`s. Hrefs are built from the page `href` helper so clicking a card applies the matching filter. |
| `DemosFilters.tsx` | Chips (search / when / status / stage / owner / source / demo type / country / needs follow-up) + `FilterSheet` with the full control set. |
| `DemoCalendarWeek.tsx` | Hour-grid week view (08:00–18:00), absolute-positioned blocks, red "now" line on the current day. Horizontally scrollable on mobile. |
| `DemoAgenda.tsx` | Mobile-friendly, day-grouped week agenda. |
| `DemoList.tsx` | Sortable table (demo / when / type / value / owner / follow-up / status) + link pagination. |
| `DemoDetailDrawer.tsx` | Read/update drawer: instant status + assignee selects, editable demo fields, lead context, affiliate context, activity timeline. |
| `BookDemoModal.tsx` | New-demo capture modal with lead picker, datetime-local, duration, demo type, assignee, and real conflict warnings. |
| `demoUi.ts` | Shared formatting helpers (time/day labels, status accents, initials). |

## Data flow

1. **Load**: `getAllDemos()` + `getLeads()` + `listUsers()` synchronously.
   Affiliate names come from Prisma (`affiliateCommission` joined to
   `affiliate`) inside `page.tsx` behind try/catch — a failure there never
   breaks the page. Lead events are read in a single `readData()` pass and
   grouped into `eventsByLead` (newest first, capped at 30 per lead) for the
   drawer timeline.
2. **Scope**: non-`leads.manage` users see only demos where `assignedTo`
   matches their email or `canAccessLead(user, lead)` holds. URL filters can
   never widen this set.
3. **Enrich**: `enrichDemo` attaches owner name, lead name/email, and
   affiliate name to each row.
4. **Derive**: `demosKpis(rows, now)` rollups drive the eight cards.
5. **Filter / sort / paginate**: `filterDemos` → `sortDemos` → client slice
   in the workspace for the list view. Every filter and page lives in the
   URL (`href(patch)`), so states are shareable and back-forward safe.
6. **Mutations**: the drawer PATCHes `/api/marketing/demos/[id]`, the modal
   POSTs `/api/marketing/demos`. Both `router.refresh()` on success so the
   server recomputes.

## KPI derivations (all from real stored data)

Default time window for the "next N days" ranges is 30 days.

| Card | Rule |
| --- | --- |
| Today | `startsToday` |
| This week | `startsThisWeek` |
| Upcoming | `startsUpcoming` (between now and +30 days) |
| To confirm | `status === "new"`, starts within the next 30 days |
| Needs follow-up | `demoNeedsFollowUp` (see below) |
| Completed | `status === "completed"`, starts within the last 30 days |
| No-shows | `status === "no_show"`, starts within the last 30 days |
| Demo→deal | `toWon / completed` over the last 30 days, formatted as a
  percentage; `"—"` when `completed === 0`. |

**Needs follow-up** is a real, derived signal, not a stored flag: the demo's
status is `completed`, `no_show`, or `reschedule_requested`; the lead stage
is not `won`/`lost` and the lead has no `convertedCustomerId`; the demo
started within ±30 days of now; and either no `nextFollowUpAt` is set or it
is overdue. It is exposed as the URL filter `followUp=1` and wired to a clickable
chip and a KPI card.

## Affordances

- Header "Book a demo" button opens `BookDemoModal` with real conflict
  warnings (same-assignee overlaps; cancelled/completed/no-show demos never
  count as conflicts).
- Week view blocks open the drawer; `→`/`←` and clickable range jump weeks.
- List view columns are sortable via URL `sort`/`dir`; pagination links keep
  the current filters.
- Drawer: instant `PATCH` on status/assignee change; demo type, meeting URL,
  phone, and notes are saved via an explicit Save button (dirty-aware).
- Needs-follow-up rows show an amber chip; converted demos show a green chip.
- Timezone label is computed client-side (`Intl`) so times always render in
  the viewer's own timezone.

## Deliberately honest / FUTURE

- **Property intelligence** in the drawer states plainly that property score
  and claim status are not yet linked to marketing leads (no fabricated
  scores).
- Property names come from Prisma when available; otherwise just the lead
  record. Lead-stage → demo-outcome funnels only use real stage/convert data.
- Changing a demo status writes the same lead-timeline events as before —
  the pipeline follows automatically; nothing is simulated.

## Tests

- `lib/marketing/demosView.test.ts` — 17 tests (fixed clock `2026-03-04`).
- Full suite: `npm test` (680 tests). Two integration files
  (`tests/integration/financial.test.ts`, `tests/integration/payments.test.ts`)
  can fail with `EBUSY`/sqlite socket timeouts on Windows when the whole suite
  runs in parallel against the same `var/data.json`; both pass in isolation
  (40/40 and 46/46). This is a pre-existing environmental flake, not related
  to the demos workspace.

## Running

- `npm run typecheck`, `npm run lint`
- `npm run build` (prisma generate + fix-prisma-runtime + next build)
- `npm run launch:check`, `npm run smoke` (16/16)