# HOMEPAGE PROPERTY TYPES UX

Visual + UI/UX upgrade for the homepage property-types section (`#solutions-home`),
turning the former flat, repetitive grid of 8 near-identical dark cards into an
interactive, imagery-led "Built for every kind of property" chapter.

## 1. Property taxonomy (single source)

- Canonical data lives in **`lib/solutions.ts`** (`SOLUTIONS` array). No copies.
- The `Solution` type was **extended** (additive, non-breaking for existing
  consumers like `/solutions/[slug]` and `SolutionsStrip`) with:
  - `image` + `imageAlt` — photographic visual per property type.
  - `accent: PropertyAccent` — semantic color (badge / glow / active / CTA).
  - `audience` — who the property type is for.
  - `value` — primary HospiOS value proposition (property-specific).
  - `capabilities` — 3–4 human-facing capabilities (not the raw module chip list).
  - `cta` — contextual primary CTA label.
- 10 property types in `SOLUTIONS`. The homepage showcases the **8 core types**
  via a curated order in `lib/solutions.ts` (`SHOWCASE_SOLUTIONS` +
  `getShowcaseSolutions()`). The 2 advanced types (hourly-flexible-stays,
  experimental-stays) stay in the catalogue but are not promoted on the home
  page — the public selector is kept manageable per the design intent.

## 2. Image strategy

- Source: **`images.unsplash.com`** via `next/image`. Already allowlisted in
  `next.config.ts` (`images.remotePatterns`) — the project's approved remote
  source. Unsplash License permits commercial use without attribution.
- Every showcased type has a distinct, hospitality-themed photo (lobby, skyline,
  hostel common area, villa+pool, boutique interior, resort pool, B&B bedroom,
  apartment living space).
- **Optimization:** `fill` + `sizes="(min-width: 1024px) 720px, 92vw"` → the
  browser fetches only the resolution it needs (320→1094px natural widths across
  viewports). `priority` is set only for the initially-active image; every other
  type lazy-loads on selection. `loading="lazy"` + `next/image` (AVIF/WebP,
  responsive srcset) built in.
- **Honesty:** the image carries a "HospiOS preview" badge and the product-UI
  is illustrative — no fabricated live property metrics are shown.

### Replacing images later
Swap the `image` URLs (or the `src`) in `lib/solutions.ts` for project-owned /
licensed files under `public/images/property/*.webp`. Because all consumers read
the single `SOLUTIONS` source, no component changes are required.

## 3. Component architecture

New client component: **`components/marketing/PropertyTypeShowcase.tsx`**
(rendered by `app/page.tsx` in the `#solutions-home` section).

- **Selector** (`<nav aria-label="Property types">`):
  - Desktop (`lg+`): vertical category list on the left (~24%).
  - Tablet/mobile (`< lg`): horizontally scrollable pill row above the panel.
  - Each item: icon chip (accent tinted when active), name, animated underline.
  - Keyboard-accessible `button` with `aria-pressed` / `aria-current` + visible
    `focus-visible` outline.
- **Featured panel** (right ~76%): fixed-aspect image area + content card
  (title, audience, value proposition, capability pills, CTAs).

Reuses existing design system: `SectionHeading`, `Icon`, `Reveal` (page-level
scroll), `next/image`, `next/link`, and the shared Tailwind tokens. The old
`components/marketing/PropertyTypes.tsx` is removed (fully superseded).

## 4. Interaction model

- **Select a type** → crossfades the image (two-layer, ~550ms), swaps content
  (title / value / pills / CTAs) via a keyed fade-up, updates accent + CTA.
- **Hover** microinteractions: primary CTA lift + arrow slide, selector item
  border/bg highlight. No over-animation.
- **CTAs (per type, contextual):**
  - Primary → property-specific label → `/solutions/[slug]` (e.g. "Run Your
    Hostel"). Non-empty, real routes.
  - Secondary → "Check how your {property} performs" → `/score-check` (the
    existing property-score lead funnel).
- Analytics fired (existing infra):
  - `property_type_view` (on mount), `property_type_select` (switch),
    `property_type_solution_click` (primary CTA),
    `property_type_score_click` (score CTA).
  - Server-side `validateMarketingEvent` already accepts free-form names; only
    the client `PublicEventName` union in `lib/marketing/track-client.ts` was
    widened to add the `property_type_*` names.

## 5. Responsive behavior

| Breakpoint | Layout |
|---|---|
| 320–640 (mobile) | horizontal pill selector + full-width featured panel; no tiny cards |
| 768 (tablet) | compact horizontal pills + featured panel |
| 1024 | stacked side-list + featured panel (fits comfortably) |
| 1280 / 1440 / 1920 | left list (~24%) + large featured panel (~76%), generous imagery |

Verified across 1440/1280/1024/768/640/414/390/375/360/320: **zero horizontal
overflow**, no clipped text, no layout shift on switching types.

## 6. Motion system

- New animation classes in `app/globals.css`: `content-swap`, `animate-content`,
  `pill-in`, `crossfade-in` (keyframed, ~0.4–0.55s, cubic-bezier).
- Subtle scroll parallax on the featured glow via a transform (rAF-throttled).
- **Reduced motion:** all new classes were added to the existing
  `@media (prefers-reduced-motion: reduce)` block; the deco parallax element is
  unmounted and its transform zeroed when reduced motion is active.

## 7. Accessibility

- Semantic `<nav>` + `button` category selection; `aria-pressed` / `aria-current`.
- Visible `focus-visible` outlines on selector + CTAs.
- Descriptive `alt` for every image.
- Property names, values and CTAs are real text (never image-only).
- Sufficient contrast maintained; motion fully disableable.

## 8. SEO

- All property links point to the existing, meaningful `/solutions/[slug]` pages
  (single canonical source), and the score CTA points to `/score-check`.
  No SEO-only pages were fabricated.

## 9. Lead-generation strategy

- Selecting a property type deepens the copy to that audience and surfaces a
  contextual score CTA ("Check how your {property} performs") into the existing
  free-score funnel (`/score-check`), plus a primary CTA into the matching
  solution page. No unnecessary personal information is collected.

## 10. Verification

- Gates: `tsc --noEmit` ✅ · `eslint` ✅ · `build` ✅ · `launch:check` (FAIL 0) ✅ ·
  `smoke` (16/16) ✅.
- `vitest`: 685/689 pass in a full run; the remaining 4 are pre-existing
  cross-file shared-state flakes (file-backed DB) that pass 100/100 when run in
  isolation — unrelated to this UI change.
- Browser QA (Playwright): all 8 images load via `next/image`, no failed image
  requests, no console/page/hydration errors (a 403 on the analytics beacon is a
  local-dev-only origin quirk, not production), no layout shift on switch,
  reduced-motion disables all added animation, zero overflow at 320→1440.