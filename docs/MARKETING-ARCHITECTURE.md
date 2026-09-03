# HospiOS — Marketing Architecture

> Grounded in the actual codebase. This covers the public marketing website and
> the growth/lead-generation layer. Companion:
> `docs/PROPERTY-INTELLIGENCE-ENGINE.md` (score/lead magnet internals).

---

## Public routes (unauthenticated)

Marketing/public routes under `app/`:

`/` (homepage), `/about`, `/alternatives`, `/blog`, `/careers`,
`/case-studies`, `/contact`, `/faq`, `/integrations`, `/knowledge-base`,
`/migration`, `/news`, `/platform` (+ `/platform/[slug]`), `/pricing`,
`/privacy`, `/product-updates`, `/product-videos`, `/solutions`
(+ `/solutions/[slug]`), `/security`, `/terms`, plus public property routes
`/properties`, `/property/[id]`, and `/ref` (referral landing). Open Graph
images: `/og`.

## Growth / conversion routes

`/demo` (book a demo), `/free-score` and `/score-check` (property score), each
feeding the growth pipeline.

## Navigation & shell

- `components/Header.tsx` — sticky site header with Platform/Solutions/
  Resources dropdowns and a mobile menu (portalled, focus-trapped dialog).
- `components/marketing/Footer.tsx`, `components/marketing/PageHero.tsx`,
  `SectionHeading.tsx`, `Reveal.tsx`, and marketing design-system icons
  (`components/marketing/icons.tsx`).
- `components/marketing/BackToTop.tsx`, `ScrollProgress.tsx` (site shell in
  `app/layout.tsx`), JSON-LD organization schema, `app/sitemap.ts`,
  `app/robots.ts`.

## Conversion components

| Component | Purpose |
|---|---|
| `BookDemoForm` (`/demo`, homepage) | Demo booking → POST `/api/demo` (`lib/demo.ts`) |
| `ContactForm` (`/contact`) | Contact → POST `/api/demo` (source=contact) |
| `PropertySearch` / `PropertyScoreView` / `PropertyReport` / `ReportEmailForm` | Score lead magnet |
| `TrackCta` | Tracked CTA links (analytics on activation) |

## Marketing admin & analytics

- UI: `app/marketing-admin/**`; API: `/api/marketing/**` (stats, export,
  audit, `track`/`track-event`, users, leads, campaigns, forms, demos) and
  `/api/leads/**`.
- Growth leads/demos/pipeline/campaigns are managed through these routes and
  the marketing DataFile; attribution feeds the SaaS affiliate layer via
  `AffiliateCommission.leadId`.

## Design system notes

- Marketing pages render on dark zinc surfaces via explicit classes
  (`bg-zinc-950/900`), independent of any `html.dark` class state.
- Tailwind v4; shared tokens/utilities in `app/globals.css`.
- Responsive: shell is fully responsive (desktop nav at `lg:`, mobile menu
  below). Verified no horizontal overflow across 1440px and 360px viewports.

## Conversion analytics

- Event tracking via `lib/marketing` (client `track()` helper) and
  `/api/marketing/track-event`. CTAs tracked on activation (`TrackCta`).
- Note: local analytics endpoints may 403 outside production — this is
  expected and unrelated to activation logic.

## CTAs → real destinations

Every CTA should resolve to an actual route. Verified anchors exist for
`#check-score`, `#platform`, `#how-it-works`, `#modules`, `#plans`,
`#getting-started`, `#main`. Keep CTA destinations in sync when routes change.
