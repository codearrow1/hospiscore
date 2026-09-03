# Homepage Integrations / Ecosystem Section — UX

**Session:** Homepage partner upgrade (property-types, score, integrations). This doc = integrations only.
**Branch:** `release/financial-hardening-2026-08-24` (local only; not committed/pushed; not live).
**Prod:** `http://localhost:3120` (running with new section).
**Live:** `https://thebuddharice.online` still on old release (user triggers hPanel deploy manually).

---

## What changed

Replaced the legacy `components/marketing/IntegrationBar.tsx` (a static text-pill marquee of 12
names + a "36+ connected integrations" trust line) with a premium, interactive ecosystem section:

- **New component** `components/marketing/EcosystemShowcase.tsx` (client component), wired into the
  `#integrations`-area of `app/page.tsx`.
- **Deleted** `components/marketing/IntegrationBar.tsx` (superseded; no remaining references).
- **`components/marketing/Marquee.tsx`** gained an optional `reverse` prop (applies
  `animation-direction: reverse`; default unchanged), so marquee lanes can scroll in opposing
  directions. Reduced-motion handling is inherited from the existing `@media (prefers-reduced-motion)`
  rule in `app/globals.css` (still forces the track static / `0s`).
- **`lib/integrations.ts`** rewritten as a structured, truthful catalogue while preserving the
  legacy exports the `/integrations` page and index rely on (`INTEGRATION_GROUPS`,
  `TOTAL_INTEGRATIONS`, `INTEGRATION_LOGOS`). Adds `IntegrationCategory`, `IntegrationStatus`
  (`"supported"` | `"available"`), `IntegrationItem`, `INTEGRATION_CATALOG`, `CATEGORY_LABELS`,
  `SUPPORTED_CATEGORIES`, `SUPPORTED_COUNT`, `integrationsByCategory()`, `integrationItem()`.
- **`lib/marketing/track-client.ts`** `PublicEventName` widened with `integration_section_view |
  integration_category_select | integration_logo_hover | integration_logo_click |
  integration_request_click | integration_demo_click`.

## Section anatomy (top → bottom)

1. **HospiOS-central node visual** — small pulsing network glyph with a "HOSPIOS — Hospitality
   Operating System" caption, framed by a soft radial glow. CSS-only `animate-glow` (reduced-motion
   disabled).
2. **Subline** — "One platform. Everything connected."
3. **Category filter** — pills: All, OTAs, Payments, Calendars, Accounting, Communication,
   Hardware. Client-state; no reload; tracked `integration_category_select`.
4. **Featured tiles** — grid (2/3/4 columns). On "All": 4 supported payment gateways + 4 ecosystem
   platforms (Booking.com, Airbnb, Expedia, Google Calendar) for visual breadth. Each tile shows a
   **clean text-logo wordmark** (name + accent), a short role descriptor, and a truthful status chip
   (`Supported` = emerald, `Available` = neutral). Tap/click toggles a capability row (only real
   catalogue capabilities). Hover (desktop) tracked via `integration_logo_hover`; tap via
   `integration_logo_click`.
5. **Multi-row animated marquee** — 3 labelled lanes (OTAs & distribution / Payment gateways /
   Communication), opposite directions and speeds, reusing `Marquee`. Lane labels are truthful
   (e.g. the third lane is explicitly "Communication", not a fabricated blend).
6. **Trust strip** — 4 cards: Gateway-secured payments (uses real `SUPPORTED_COUNT`), Cloud-based
   platform, API-first integrations, Human support.
7. **API-first statement** — "CONNECT ANYTHING" band with HospiOS API / Webhooks → OTA · Payments ·
   CRM · Accounting · Hardware.
8. **Lead CTAs** — "Request an integration" → `/integrations` (`integration_request_click`) and
   "Book a demo" → `/demo` (`integration_demo_click`), plus a footer line: "Bring your existing
   stack. HospiOS connects the rest — 36 integrations and growing." (uses real `TOTAL_INTEGRATIONS`).

## Truthfulness & compliance decisions (user-confirmed)

- **Clean text-logo wordmarks** — no fake/recolored brand logos, no external CDN assets; zero
  broken-image risk. Matches the "clean text fallback" guidance.
- **Truthful mixed status, never "connected"**:
  - **Payments = "Supported"** — these reflect real wired adapters in the Saas payments layer
    (`lib/saas/payments/catalog.ts` + `lib/saas/adapters/*`): Stripe, Razorpay, PayPal, PayU,
    Cashfree, Adyen, Checkout.com, Square.
  - **OTAs / calendars / comms / hardware / accounting = "Available"** — ecosystem catalogue, shown
    as platforms you can connect, never "connected".
- **"36+"** dropped the word "connected" (the old line "36+ connected integrations" overstated what
  is wired). Now it is simply the real registry count, phrased "integrations and growing" / "Bring
  your existing stack… connects the rest".
- **No fabricated capabilities** — each tile's expanded chips come only from the catalogue entries.
- Client `track()` events are free-form on the server; local `sendBeacon` still returns `403`
  (pre-existing env-local quirk — `originAllowed` localhost vs prod `SITE_URL`; `track()` swallows
  it, not present in production, not a regression).

## Accessibility & resilience

- **Reduced motion** — the glow, marquee lanes, and any reveal animation are disabled/zeroed by the
  existing `@media (prefers-reduced-motion: reduce)` guard (verified: marquee `animation-duration` →
  `0s`, i.e. static).
- **Keyboard / semantics** — filter pills are real `<button aria-pressed>`; tiles are real
  `<button aria-expanded>` toggles; CTAs are real anchors. No custom scroll logic.
- **No overflow** — verified 0 px horizontal overflow at 320, 360, 375, 390, 414, 768, 1024, 1280,
  1440 widths (mobile stacks 2→1 columns; marquee mask clips).
- **IntersectionObserver** gathers `integration_section_view` once at 30% visibility; disconnected
  after first fire (no repeated beacon spam).

## Verification (focused on this section)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `npm run build` | PASS |
| `npm run launch:check` | FAIL 0, NOT VERIFIED 3 (pre-existing live-host items) |
| `npm run smoke` | PASS 16/16 |
| Browser QA (9 viewports) | overflow 0; 7 filters; 8 tiles; 3 marquee rows; heading/API/36+/CTAs/node all present |
| Payments filter | 8 tiles → all 8 supported gateways (Stripe, Razorpay, PayPal, PayU, Cashfree, Adyen, Checkout.com, Square) |
| Tile detail toggle | capability chips 8 → 11 on expand |
| Reduced motion | marquee `animation-duration: 0s` (static) |
| Console errors | only `/api/marketing/track-event` 403 (pre-existing local analytics quirk) |
| Vitest | 654–689 pass; see note below |

**Vitest note:** a full run showed 3 failures in DB integration files
(`tests/integration/financial.test.ts`, `tests/unit/claim-request.test.ts`) driven by SQLite
`Socket timeout` / unique-constraint collisions on the shared `var/data.json` — flaky DB contention,
not related to these changes (the touched files do not exercise claim/payment/financial logic). The
prior baseline was 689/689. Re-running those files intermittently passes.

## Files touched (integrations work)

- `components/marketing/EcosystemShowcase.tsx` — **new** premium ecosystem section.
- `components/marketing/Marquee.tsx` — added `reverse` prop (backward compatible).
- `components/marketing/IntegrationBar.tsx` — **deleted** (superseded).
- `app/page.tsx` — integrations section now renders `<EcosystemShowcase />`; heading/subtitle copy
  updated to "Works with the tools you already use".
- `lib/integrations.ts` — structured truthful catalogue (legacy exports preserved).
- `lib/marketing/track-client.ts` — added `integration_*` events.

## Next (not yet done)

- Commit + push the three homepage sessions (`property types`, `score`, `integrations`).
- User to trigger Hostinger hPanel deploy so `thebuddharice.online` picks up the new release.