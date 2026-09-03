# HospiOS Homepage Upgrade — UX Architecture

Status: Implementation blueprint for the `/` redesign.
Branch: `release/financial-hardening-2026-08-24`
Stack: Next.js App Router (15), React 19, Tailwind v4 (`@theme inline`), RSC default, client islands for interactivity.

> Guardrails (driven by both product roadmap and the earlier live-incident history):
> **Never fabricate** testimonials, logos, metrics, screenshots, or integrations.
> **No dead CTAs** — every button/action maps to a real funnel.
> **Reuse** existing components/tokens/routes; no duplicate implementations.

---

## 1. Goal & Principles

Turn the homepage from a stacked feature-page into a **story-driven acquisition surface** that
(a) earns trust with design (~2s), (b) makes the product concrete via a live-feeling (but honest)
operations Dashboard, and (c) funnels visitors into one of four real CTAs:

| Ladder | Label | Target |
|---|---|---|
| Primary | Book a Demo | `/demo` (BookDemoForm) |
| Secondary | Check Your Property Score | `/score-check` (PropertySearch) |
| Tertiary | Explore HospiOS | in-page product tour |
| Low-friction | See Pricing | `/pricing` (Pricing snapshot) |

Header nav keeps its existing sticky/scroll-compact behaviour and dropdowns; it is already
compliant. Only the Check-Property-Score tertiary CTA is surfaced explicitly.

## 2. Information Architecture (top-down)

`Header (sticky, compact)` → `Hero` → `Logos/Trust strip` → `Property Types (solutions)` →
`Property Score lead magnet` → `Ecosystem (one platform)` → `Product tour (Demo in Hero reuse)`
→ `Before/After` → `Modules grid` → `Revenue/Front-desk proof (Showcase)` →
`Pricing` → `Integrations` → `Testimonials/FAQ` → `Final CTA` → `Footer`.

Ordering rationale: hero lands with credibility + a partner CTA; property types give instant
relevance; the **free score is the strongest acquisition CTA** (real, monetisable, existing) so it
gets a dedicated section instead of being buried; then concrete product UI; then pricing/decision
support; then closing.

## 3. Component Architecture

All new/refactored homepage pieces live under `components/` (client islands where interactive).
Server-rendered heritage components are re-composed, not rewritten.

| Section | Component(s) | Interactivity | Reuses |
|---|---|---|---|
| Header | `Header.tsx` (keep) + explicit Score CTA | client (scroll/sticky/mobile) | existing nav model |
| Hero | `Hero.tsx` (rework) + `HeroDashboard` | client (tabs, floating KPI) | `UiMock`, icons |
| Logos | `Marquee.tsx` | client | existing |
| Property types | `PropertyTypes.tsx` | minor | `lib/solutions.ts` |
| Score magnet | enhance `PropertySearch.tsx` usage | client (autocomplete) | existing funnel |
| Ecosystem | `Ecosystem.tsx` | client (tabs) | `lib/modules.ts`, icons |
| Product tour | `ProductTour.tsx` (add Finance/AI/Marketing) | client (live UiMock) | existing |
| Before/After | `BeforeAfter.tsx` | client (toggle) | existing visuals |
| Modules | `ModuleGrid.tsx` (keep) | none/client | existing |
| Proof | `Showcase.tsx` (keep) | server + TiltCard | existing sample data |
| Pricing | `Pricing.tsx` (keep) | client (geolocate) | existing |
| Integrations | `Security.tsx` / `Support.tsx` (keep) | client | existing |
| Testimonials/FAQ | `Testimonials.tsx`, `Faq.tsx` (keep) | client | existing |

New-only assets: `Hero.tsx`, `HeroDashboard.tsx`, `PropertyTypes.tsx`, `Ecosystem.tsx`,
`BeforeAfter.tsx`, `lib/marketing/events.ts` + `client-track` helper. Everything else is
re-composition of existing components to minimise regression surface.

### 3.1 HeroDashboard (honest cinematic core)
`UiMockVariant` currently renders `dashboard` as a static skeleton. New `HeroDashboard` wraps the
**real dashboard product UI** the way `UiMock` does — but strictly as clearly-labelled UI mockup
with a `Preview` tag: no fabricated data, no screenshot. Three interactive tabs (live KPIs,
front desk rooms, revenue) highlight the breadth without over-claiming. Respects
`prefers-reduced-motion` (floating KPIs idle on reduced motion).

## 4. Motion & Design Tokens

- Reuse existing `globals.css` tokens (`--surface`, `--brand #4f46e5`, `--accent #7c3aed`,
  `--success #059669`) — no new palette.
- Motion classes are additive and guarded by `@media (prefers-reduced-motion: reduce)`; the
  existing `Reveal` (IntersectionObserver) stays for scroll reveals.
- No animation/render/fetch loops: all client state is local and gas-free; no polling, no timers
  unless transparently user-activated.

## 5. Funnels (no dead CTAs)

1. **Property Score** → `PropertySearch.tsx` → `/score-check` (free) → `/free-score` (report +
   `ReportEmailForm` capture). The homepage section surfaces the search box inline and links deep
   to `/score-check` for full funnel.
2. **Demo** → `BookDemoForm.tsx` (`compact`) → `/api/demo` → marketing-admin pipeline.
3. **Pricing** → `Pricing.tsx` (geolocate + catalog via `/api/pricing/geolocate`,
   `/api/pricing/catalog`).
4. **Analytics**: pages keep `/api/marketing/track` page-view beacon. A new **additive**,
   privacy-light `MarketingEvent` store + `POST /api/marketing/track-event` + client `track()`
   helper records named conversion events (my) — see §6. It mirrors the existing privacy model
   (session-keyed, no PII) and does **not** modify existing track behaviour.

## 6. Conversion Analytics (additive, no schema break)

- `lib/marketing/types.ts`: add optional `marketingEvents: MarketingEvent[]` to the store shape
  (writeData spreads `...d`, so a new key is backward-compatible).
- `lib/marketing/events.ts`: `recordMarketingEvent(scope, name, meta)` + `eventCount()`.
- `app/api/marketing/track-event/route.ts`: guarded by the same `originAllowed`/`rateLimit`/
  `clientIp` guards as `/api/marketing/track`; store only event name + session + optional meta.
- client helper `lib/marketing/track-client.ts`: fire-and-forget beacon, safe under
  `typeof window`. Fired on `demo_cta`, `score_cta`, `score_submit`, `pricing_view`.

Rationale for the small new surface: the audit found no named conversion events, and §34 requires
them; the lightweight approach avoids touching the page-view pipeline and the operational data
store. No DB migration, no runtime risk to existing routes.

## 7. Accessibility & Performance

- Semantic landmarks (header/nav/main/section/footer); `<section aria-labelledby>` headings.
- All interactive tabs/toggles keyboard-operable, focus-visible outlined, ARIA `tablist/tab/panel`.
- `prefers-reduced-motion` respected via CSS guard, `Reveal` honours it.
- Client islands scoped to interactive sections; hero/product-tour stay server-renderable where
  possible. No `use client` on pure-presentation sections.
- Contrast checked against `--surface`/`--brand` (indigo 4f46e5 on white = WCAG AA text only at
  large sizes; used for large headers/CTAs).
- No RSC serialization regression introduced (no new server components exporting functions/classes).

## 8. SEO & Content Accuracy

- Preserve existing `metadata`/OG (`lib/site.ts`); reuse `JsonLd.tsx` for software markup already
  wired. Do not change titles that rank.
- Every factual claim maps to `lib/modules.ts` / `lib/solutions.ts` / `lib/integrations.ts`.
  Unreleased capabilities are explicitly labelled "Planned"/"Coming Soon"; boundaries honest
  (channel/OTAs real list from `lib/integrations.ts`).

## 9. Verification (final gates)

`npx tsc --noEmit` → `npm run lint` → `npx vitest run` → `npm run build` →
`npm run launch:check` → `npm run smoke` → Playwright visual QA at 320/576/768/1024/1280/1440/1920.
Return `# HOSPIOS HOMEPAGE UPGRADE REPORT` with severity/root-cause/fix/verification/status table.