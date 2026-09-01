# PWA / DEVICE LAUNCH CHECK — HospiOS SaaS Management App

**Release:** `9eefac5` · Repository-side PWA/device readiness. Browser-installability / runtime
viewports are **HOST-VERIFICATION-REQUIRED** (must be observed in a browser after deploy); the
repo-side artifacts below are verified.

## Repository-side PWA artifacts (verified)
| Artifact | Location | Present | Notes |
|----------|----------|---------|-------|
| Web app manifest | `public/manifest.json` | ✅ | name/short_name, `start_url: "/"`, `display: standalone`, theme/background colors, icons |
| Icons | `public/icon-192.svg`, `icon-512.svg`, `icon-maskable.svg` | ✅ | 192/512 + maskable |
| Favicon | `app/favicon.ico` | ✅ | |
| Metadata | `app/layout.tsx` | ✅ | `manifest: "/manifest.json"`, viewport, OpenGraph, canonical, keywords/authors |
| Service worker | `public/sw.js` + `components/ServiceWorkerRegistration` | ✅ | precaches `/`, `/manifest.json`, icons; **network-first**; **never intercepts `/api/*`** |
| Robots/sitemap | `app/robots.ts`, `app/sitemap.ts` | ✅ | |

## Service-worker caching safety (Phase 35) — verified
- `GET` only; **all `/api/*` requests are excluded** (line 20) ⇒ private customer data, financial
  data, and payment responses are **never** cached in the SW.
- Precaches only static assets; runtime cache is same-origin non-API GET (network-first w/ cache
  fallback). No PII/financial data cached. Compliant with the "do not cache private/financial data" rule.

## Device / responsive (repo-level)
- Tailwind 4 responsive utilities throughout; the acceptance matrix marks login/signup/claim/
  onboarding/billing/admin as responsive. Concrete **viewport verification (320–1280) is
  `HOST-VERIFICATION-REQUIRED`** — observe in a real browser after deploy.

## Host / browser verification REQUIRED (cannot be proven from repo)
1. `/manifest.json` loads and icons resolve over HTTPS.
2. Browser installability (Service Worker registered, install prompt / "Install app") — observe.
3. Offline fallback for static pages works without caching private/financial data.
4. Viewports 320/360/390/412/768/1024/1280 on login, signup, claim, onboarding, billing, payment, admin.

## Guardrails
- **Do NOT** add SW caching for `/api/*`, `/customer/*`, `/saas/*`, billing/payment responses, or
  error pages containing secrets.
- **Do NOT** claim browser-installability until actually observed in production.
