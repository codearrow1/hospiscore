# HOSPIOS — PROPERTY SCORE SECTION UI/UX UPGRADE

## Scope
The homepage "Free tool / score" section (`#score`) previously contained a
three-row `Showcase` whose first row was a text-heavy `"One score"` block with a
single static `ScoreGauge score={80}` (number + "Good") inside a rounded box.
This doc covers the upgrade of that score offer into a premium, interactive
**Property Intelligence** experience, built entirely on the existing canonical
scoring engine.

## Truthfulness model (data source decision)
- The homepage is a **static marketing page** with **no selected property**, so
  it cannot render a real live score (real scores appear only inside the
  `score-check` funnel once a property is chosen).
- The displayed `80 / Good` is therefore an **illustrative example**, explicitly
  badged **"Illustrative example"** in the panel. It is labeled as example data
  and never presented as live customer data.
- The example is built on the **real canonical semantics**: the 13 signal labels
  and weights come from `lib/scoring.ts` `WEIGHTS`, and the grade comes from
  `gradeForScore` (>=85 Excellent, >=70 Good, >=50 Fair, <50 Poor → 80 = Good).
  The sample component values are tuned so their weighted sum rounds to 80,
  keeping the demo internally consistent.
- **Benchmarking** and **score history** are NOT invented. The panel states
  "Market benchmarking and score history appear **after your scan**". This is
  honest: `datasetBenchmark()` and `getScoreStore().history()` only produce real
  values for a chosen property in the funnel.
- Provenance copy mirrors `lib/marketingCopy.ts` (demo-mode): "Every signal is
  labelled verified or not yet verified — we never invent data that isn't
  available." The static label was inlined (not imported) because that module
  pulls in Node-only `lib/config` and must not enter the client bundle.

## Current problems (before)
| ID | Severity | Problem |
|----|----------|---------|
| P1 | High | Right side is mostly empty — just a lone score number in a rounded box |
| P2 | High | No visual explanation of HOW the score is calculated |
| P3 | High | No category / 13-signal breakdown |
| P4 | High | No evidence / provenance indicator |
| P5 | High | No benchmarking or history states |
| P6 | High | `"80 Good"` reads as a static marketing mockup |
| P7 | High | No strong CTA / lead-gen hook to the score funnel |
| P8 | Med  | Long body paragraph, low scannability |
| P9 | Med  | Section didn't showcase the score engine's breadth (13 signals) |

## Visual architecture
Two-column layout (desktop `lg:grid-cols-[0.85fr_1.15fr]` ~41% / 59%):

- **Left column — offer & lead capture**
  - Eyebrow "One score"
  - Title: *"See how strong your property's digital presence really is."*
  - Short body: *"One intelligent score built from the signals guests and search
    engines actually see — ratings, reviews, listings, website, social and more."*
  - 3 proof points (aligned to the real engine claims)
  - Primary CTA: **"Check your property score"** → `/score-check`
    (tracked `score_cta`)
  - Secondary: **"See how it works"** → `#how-it-works` anchor

- **Right column — interactive intelligence dashboard** (clearly badged
  "Illustrative example"):
  - **Radial score gauge** (SVG ring, animated draw-in + count-up)
    - Center shows `<CountUp to=80> / 100`, grade chip "Good", label
      "Digital presence"
    - Accessible `aria-label`: "Property score 80 out of 100, good. This is an
      illustrative example — run a real scan to see your property's score."
  - **13 weighted signals** breakdown (all 13 `WEIGHTS` keys) with color-coded
    markers + weight %. **Click/tap** a row to expand its evidence detail
    (tracked `score_category_open`; hover tracked `score_category_hover`).
  - **Biggest opportunity** card — derived from the sample's weakest signal
    (Accessibility 58), with a pointer to the free report.
  - **Data sources** card — Google / Website / Reviews / Social / OTA chips +
    provenance text.
  - **Track over time** card — mini illustrative sparkline + explicit statement
    that real benchmarking/history appear after your scan.
  - Full-width CTAs: **"Get my free property report"** (`score_report_click`)
    and **"Run my own scan"** (`score_demo_click`) — both → `/score-check`.

- **Layer depth**: atmospheric indigo radial glow + a faint 24px fine-grid
  background on the panel, subtle shadows; restrained — intended as
  "hospitality intelligence + premium SaaS", not a cyberpunk dashboard.

## Score visualization
- Reuses `gradeForScore` / `gradeColor` from `lib/scoring.ts` (no second engine).
- Ring drawn via SVG `stroke-dashoffset` driven by `requestAnimationFrame`
  (not per-frame React state beyond the single interpolated value), ~1100ms,
  then remains. Center number uses the existing `CountUp` component (already
  honors `prefers-reduced-motion` and only counts once on view).
- Under `prefers-reduced-motion`, the ring is painted immediately at its final
  value and the count-up jumps to 80 (no animation). Verified.

## Category / evidence model
- Categories = the canonical 13 `ScoreComponent` keys (ratingQuality,
  reviewVolume, reviewVelocity, responseRate, platformDiversity,
  guestExperience, presence, amenities, visualContent, sustainability,
  accessibility, directBookings, brandTrust) with real weights + labels.
- `sourced` flag semantics from `ScoreResult.components` are honored in the
  example; all demo rows are `sourced: true` but the panel is explicitly an
  example so nothing implies live data.

## Benchmarking
- Not present on the homepage (no property). Text: "Market benchmarking and score
  history appear **after your scan** — run your own property to see its real
  trend." Real benchmarking lives in `BenchmarkPanel` / `datasetBenchmark()` on
  the per-property report page.

## Score history / trend
- Not invented. The mini sparkline + `[72, 74, 77, 80]` sample is labelled
  illustrative; the card says real history appears after a scan. Real history
  uses `lib/scoreHistory.ts` + `ScoreTrend` on the report page.

## Lead-generation strategy
This section is a top-of-funnel lead asset: it demonstrates the score engine's
depth (13 signals, interactive breakdown, opportunity insight) to build
curiosity, then drives every CTA into the existing `/score-check` funnel
(search → select property → email-gated full report). No new route was created.

## Interaction
- Category rows expand inline to reveal evidence (desktop hover tracks
  `score_category_hover`; click tracks `score_category_open`).
- Gauge hovers track `score_category_hover` with meta `gauge`.
- Section view fires `score_section_view` once when scrolled into view.

## Animation system
- Scroll reveal: parent `Reveal` (existing, reduced-motion safe).
- Ring draw-in: rAF + SVG dashoffset (~1100ms), cancelled on unmount.
- Count-up: existing `CountUp` (ease-out cubic, ~1100ms, reduced-motion safe).
- No new animation library. No custom CSS keyframes required for this component.

## Responsive strategy
| Breakpoint | Layout |
|------------|--------|
| >=1024 | Two columns: copy left (~41%), dashboard right (~59%) |
| <1024 | Stacked: gauge dashboard panel first, then copy+CTAs |

Mobile keeps the ScoreGauge full-size-readable (260px cap) and the panel
full-width. No floating elements positioned absolutely on mobile. 13-signal rows
and CTAs remain readable at 320px.

## Accessibility
- Gauge has an `aria-label` describing score, grade, and the illustrative nature.
- Category rows are `<button aria-expanded>` — keyboard focusable/operable.
- Expanded evidence is exposed to AT; text, not colour alone, conveys grade.
- All interactive legend uses text labels + numbers, not colour-only.
- `prefers-reduced-motion` fully respected (ring static, count jumps, no
  reveal-blocking animation).

## Performance
- Static marketing component; no SSR data fetch, no canvas, no animation lib.
- Renders server-side with client interactivity only (robust to SSR).
- The ring uses a single rAF-interpolated value; no per-frame re-render loop.

## Analytics (existing infra)
Events added to `PublicEventName` in `lib/marketing/track-client.ts`:
`score_section_view`, `score_category_hover`, `score_category_open`,
`score_report_click`, `score_demo_click`. Existing `score_cta` reused for the
primary button. Server already accepts free-form event names (no allowlist
change needed).

## Files changed
- `components/marketing/ScoreIntelligence.tsx` — **new** score-dashboard component.
- `components/marketing/Showcase.tsx` — removed the first ("gauge") row; now keeps
  the two feature deep-dive rows (reviews + reply-drafts); dropped unused
  `ScoreGauge` import + dead gauge branch.
- `app/page.tsx` — `#score` section now renders `<ScoreIntelligence />` then
  `<Showcase />`; added import.
- `lib/marketing/track-client.ts` — widened `PublicEventName` union.

## Verification (Definition-of-Done)
| # | Check | Status |
|---|-------|--------|
| 1 | Gauge visually compelling (radial ring + count-up) | ✅ |
| 2 | Score meaning immediately understandable (80 / 100 / Good / Digital presence) | ✅ |
| 3 | Category breakdown visible (all 13 signals + weight %) | ✅ |
| 4 | 13-signal concept visualized (interactive breakdown) | ✅ |
| 5 | Data provenance clear ("verified / not yet verified", illustrative badge) | ✅ |
| 6 | Benchmarking appears only with real data | ✅ (shown only after scan) |
| 7 | Historical trend appears only with real data | ✅ (shown only after scan) |
| 8 | Biggest opportunity actionable | ✅ |
| 9 | Connects to actual score-check funnel | ✅ (`/score-check`) |
| 10 | Strong lead-gen CTA(s) | ✅ (3 CTAs) |
| 11 | Right side no longer empty | ✅ |
| 12 | Motion premium + restrained; scroll reveal works | ✅ |
| 13 | Reduced motion supported | ✅ |
| 14 | Mobile / tablet / desktop work | ✅ (9 viewports) |
| 15 | No page-level horizontal overflow | ✅ (0 on 320..1440) |
| 16 | No hydration / RSC / render-loop issues | ✅ |
| 17 | No fake data (illustrative badge + honest provenance) | ✅ |
| 18 | Existing score functionality preserved (engine untouched) | ✅ |
| 19 | TypeScript passes | ✅ `tsc --noEmit` |
| 20 | ESLint passes | ✅ |
| 21 | Tests pass | ✅ vitest 689/689 |
| 22 | Build passes | ✅ `npm run build` |
| 23 | Launch check passes | ✅ FAIL 0 (3 NOT VERIFIED = live-host items) |
| 24 | Smoke passes | ✅ 16/16 |
| 25 | Browser visual QA completed | ✅ (9 viewports, geometry + behaviour probes) |

## Final issue table
| ID | Severity | Problem | Root Cause | Fix | Verification | Status |
|----|----------|---------|------------|-----|--------------|--------|
| P1 | High | Empty right side | lone ScoreGauge in a box | Rich dashboard panel + 13-signal breakdown + evidence + CTAs | QA gauge/panel present | ✅ |
| P2 | High | No score explanation | static number | "Digital presence" label + 13 weighted signals + expandable evidence | behavioral probe | ✅ |
| P3 | High | No category breakdown | -- | 13 interactive signal rows with weight % | 13 rows detected | ✅ |
| P4 | High | No provenance | -- | Data sources card + verified/not-verified text | QA | ✅ |
| P5 | High | No benchmark/history states | -- | truthful "after your scan" copy + illustrative mini-trend | QA | ✅ |
| P6 | High | Reads as mockup | -- | "Illustrative example" badge + funnel-bound CTAs | QA badge present | ✅ |
| P7 | High | Weak CTA | -- | 3 tracked CTAs → `/score-check` | cta mentions=3 | ✅ |
| P8 | Med | Long paragraph | -- | short body + 3 proof points | QA | ✅ |
| P9 | Med | Engine breadth hidden | -- | 13-signal breakdown on the homepage | 13 rows detected | ✅ |