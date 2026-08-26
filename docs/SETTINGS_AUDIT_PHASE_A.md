# HospiOS — Complete Settings Architecture Audit (Phase A)

Generated: 2026-08-26 | Codebase: `release/financial-hardening-2026-08-24` @ `499ed80`

---

## 1. EXISTING SETTINGS PAGES

| # | URL | File | Configures | Access Role | DB Backend | SystemSetting? |
|---|-----|------|-----------|-------------|------------|----------------|
| 1 | `/account/settings/profile` | `app/account/settings/profile/page.tsx` | User display name | Any auth user | File JSON (`readData/writeData`) | No |
| 2 | `/account/settings/security` | `app/account/settings/security/page.tsx` | Password change | Any auth user | File JSON | No |
| 3 | `/account/settings/notifications` | `app/account/settings/notifications/page.tsx` | Notification channels (10 event types × 3 channels) | Any auth user | File JSON | No |
| 4 | `/saas/settings` | `app/saas/settings/page.tsx` | Pricing toggle + billing/security/affiliate/SLA settings | `SYSTEM_SETTINGS_MANAGE` | Prisma `SystemSetting` | Yes |
| 5 | `/marketing-admin/settings` | `app/marketing-admin/settings/page.tsx` | Marketing role assignment + ENV display | `settings.manage` capability | Marketing user store | No |
| 6 | `/marketing-admin/pricing` | `app/marketing-admin/pricing/page.tsx` | Localized pricing, plan proposals | `pricing.manage` capability | Prisma `Plan`/`PlanCountryPrice` | Indirect |

**Dead Links in Navigation:**
- `/account/preferences` — listed in sidebar nav but page does NOT exist

---

## 2. EVERY ROLE

### 2A. Application Roles (`lib/rbac.ts`)

| AppRole | Label | Dashboard | How Resolved |
|---------|-------|-----------|-------------|
| `super_admin` | Super Admin | `/saas` | `role` in SUPER_ADMIN_TIER set OR email in ADMIN_EMAILS |
| `subadmin` | Subadmin | `/marketing-admin` | `roleFor()` returns truthy OR `role` in SAAS_ROLES |
| `staff` | Staff | `/staff` | `role` in STAFF_TIER set |
| `affiliate` | Affiliate | `/affiliate` | Portal identity found for user |
| `partner` | Partner | `/partner` | Portal identity found for user |
| `customer` | Customer | `/customer` | OrgContact found for user |

**SUPER_ADMIN_TIER:** `super_admin`, `platform_admin`, `finance_admin`, `sales_admin`, `affiliate_manager`, `partner_manager`, `franchise_manager`

**STAFF_TIER:** `support_admin`, `customer_success`

### 2B. Marketing Roles (`lib/marketing/roles.ts`)

| MarketingRole | Capabilities |
|--------------|-------------|
| `super_admin` | ALL 12 capabilities |
| `marketing_admin` | ALL 12 capabilities |
| `marketing_manager` | 8 (no leads.manage, pricing.manage, settings.manage, audit.read) |
| `sales_manager` | 6 (no campaigns, forms, content, pricing, settings, audit) |
| `sales_rep` | 4 (leads.read/write, demos.manage) |
| `content_editor` | 3 (content.manage, analytics.read) |
| `seo_manager` | 3 (content.manage, analytics.read) |
| `analyst` | 3 (leads.read, analytics.read) |

### 2C. SaaS Roles (`lib/saas/roles.ts`)

17 roles: `super_admin`, `platform_admin`, `finance_admin`, `marketing_admin`, `sales_admin`, `sales_rep`, `customer_success`, `support_admin`, `affiliate_manager`, `partner_manager`, `franchise_manager`, `analyst`, `read_only`, `billing_admin`, `billing_view`, `plan_admin`, `plan_view`

28 permissions: `CUSTOMER_VIEW`, `CUSTOMER_MANAGE`, `SUBSCRIPTION_VIEW`, `SUBSCRIPTION_MANAGE`, `PLAN_VIEW`, `PLAN_MANAGE`, `PLAN_APPROVE`, `BILLING_VIEW`, `BILLING_MANAGE`, `REFUND_MANAGE`, `AFFILIATE_VIEW`, `AFFILIATE_MANAGE`, `PARTNER_VIEW`, `PARTNER_MANAGE`, `FRANCHISE_VIEW`, `FRANCHISE_MANAGE`, `SUPPORT_VIEW`, `SUPPORT_MANAGE`, `USAGE_VIEW`, `AUDIT_VIEW`, `FEATURE_FLAG_MANAGE`, `SYSTEM_SETTINGS_MANAGE`, `PAYOUT_VIEW`, `PAYOUT_MANAGE`, `MARKETING_VIEW`, `PROPERTY_VIEW`, `PROPERTY_MANAGE`, `AUTOMATION_MANAGE`

---

## 3. CURRENT SETTING INVENTORY

### 3A. Database-Backed Settings

| ID | Setting Key | Location | Type | Scope | Mutable | Owner | UI | API | DB Model |
|----|-----------|----------|------|-------|---------|-------|-----|-----|----------|
| S-01 | `require_marketing_pricing_approval` | `lib/saas/settings.ts` | boolean | Global | Yes | Super Admin | ✅ Toggle | ✅ `/api/saas/system-settings` | `SystemSetting` |
| S-02 | `pricing_approval_required` | `lib/settings/resolver.ts` | boolean | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-03 | `admin_emails` | `lib/settings/resolver.ts` | string | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-04 | `sales_email` | `lib/settings/resolver.ts` | string | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-05 | `demo_meeting_url` | `lib/settings/resolver.ts` | string | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-06 | `session_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-07 | `public_rate_window_ms` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-08 | `public_rate_max` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-09 | `admin_rate_max` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-10 | `smtp_host/port/user/pass/from` | `lib/settings/resolver.ts` | string/secret | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-11 | `dunning_retry_schedule` | `lib/settings/resolver.ts` | json | Global | Yes | Super Admin/Billing | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-12 | `dunning_max_attempts` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Billing | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-13 | `past_due_grace_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Billing | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-14 | `suspend_after_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Billing | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-15 | `trial_duration_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Billing | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-16 | `usage_invoice_due_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Billing | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-17 | `affiliate_cookie_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-18 | `affiliate_commission_model` | `lib/settings/resolver.ts` | string | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-19 | `affiliate_commission_value` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-20 | `holding_period_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-21 | `min_payout_cents` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-22 | `fraud_threshold` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-23 | `max_tier_depth` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-24 | `fraud_*` (6 keys) | `lib/settings/resolver.ts` | number/json | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-25 | `recurring_duration_months` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-26 | `partner_default_commission_value` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-27 | `franchise_default_revenue_share_bps` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin/Affiliate | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-28 | `google_places_api_key` | `lib/settings/resolver.ts` | secret | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-29 | `deepseek_*` (3 keys) | `lib/settings/resolver.ts` | secret/string | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-30 | `apify_*` (2 keys) | `lib/settings/resolver.ts` | string | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-31 | `redis_url` | `lib/settings/resolver.ts` | secret | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-32 | `cache_provider` | `lib/settings/resolver.ts` | string | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-33 | `track_views` | `lib/settings/resolver.ts` | boolean | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-34 | `sla_hours_urgent/high/medium/low` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-35 | `health_payment_window_days` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| S-36 | `portal_claim_ttl_ms` | `lib/settings/resolver.ts` | number | Global | Yes | Super Admin | ✅ SettingsPanel | ✅ `/api/settings` | `SystemSetting` |
| F-01 | Feature flags (N) | `lib/saas/entitlements.ts` | boolean | Global/Org/Plan/Country/Property | Yes | Super Admin | ✅ FeatureFlagsManager | ✅ `/api/saas/feature-flags` | `FeatureFlag` |
| F-02 | `usage_overage_rates` | `lib/saas/usageBilling.ts` | json | Global | Yes | Billing/Admin | ❌ No UI | ❌ No dedicated API | `SystemSetting` (direct) |
| F-03 | `usage_billed_periods` | `lib/saas/usageBilling.ts` | json | Global | Internal | System | ❌ No UI | ❌ No API | `SystemSetting` (direct) |
| O-01 | `portal_bindings` | `lib/saas/portalLinks.ts` | json | Global | Internal | System | ❌ No UI | ❌ No API | `SystemSetting` (direct) |
| O-02 | `portal_claims` | `lib/saas/portalLinks.ts` | json | Global | Internal | System | ❌ No UI | ❌ No API | `SystemSetting` (direct) |
| U-01 | Notification preferences (per user) | `app/api/account/notifications/route.ts` | json | User | Yes | Self | ✅ NotificationsForm | ✅ `/api/account/notifications` | File JSON |
| U-02 | Profile name | `app/api/account/profile/route.ts` | string | User | Yes | Self | ✅ ProfileForm | ✅ `/api/account/profile` | File JSON |
| U-03 | Password hash | `app/api/account/security/route.ts` | string | User | Yes | Self | ✅ SecurityForm | ✅ `/api/account/security` | File JSON |
| N-01 | AffiliateSettings (per affiliate) | `lib/saas/affiliateSettings.ts` | json | Affiliate | Yes | Affiliate Mgr | ✅ SettingsPanel (aff) | ✅ `/api/saas/affiliate-settings` | `AffiliateSetting` |
| N-02 | Marketing user roles | `lib/marketing/users.ts` | json | User | Yes | Marketing Admin | ✅ SettingsManager | ✅ `/api/marketing/users/[id]` | File JSON |
| N-03 | Onboarding progress | `prisma schema` | json | User/Org | System | System | ❌ No UI | ❌ No API | `OnboardingProgress` |
| SEC-01 | `usage_overage_rates` (duplicate) | `lib/saas/usageBilling.ts` | json | Global | Yes | Billing | ❌ | ✅ (via resolver category) | `SystemSetting` |
| I-01 | Pricing country overrides | `lib/pricing/countries.ts` | cookie | Browser | Client | Self | ✅ PricingExperience | ❌ No API | Cookie (`hs_billing_country`) |
| I-02 | Saved lead views | `components/marketing-admin/SavedViews.tsx` | json | User | Client | Self | ✅ SavedViews | ❌ No API | localStorage |
| I-03 | Command palette recents | `components/shell/CommandPalette.tsx` | json | User | Client | Self | ✅ CommandPalette | ❌ No API | localStorage |
| I-04 | Sidebar rail state | `components/shell/AppShell.tsx` | string | User | Client | Self | ✅ AppShell | ❌ No API | localStorage |

### 3B. Environment-Backed Settings (`lib/config.ts`)

| ID | Setting | Env Var | Default | Type | Resolver Key? |
|----|---------|---------|---------|------|---------------|
| E-01 | `googlePlacesApiKey` | `GOOGLE_PLACES_API_KEY` | "" | string | ✅ `google_places_api_key` |
| E-02 | `reviewProvider` | `REVIEW_PROVIDER` | "demo" | string | ❌ |
| E-03 | `reviewApiKey` | `REVIEW_API_KEY` | "" | string | ❌ |
| E-04 | `cacheProvider` | `CACHE_PROVIDER` | "memory" | string | ✅ `cache_provider` |
| E-05 | `redisUrl` | `REDIS_URL` | "" | secret | ✅ `redis_url` |
| E-06 | `deepseekApiKey` | `DEEPSEEK_API_KEY` | "" | secret | ✅ `deepseek_api_key` |
| E-07 | `deepseekModel` | `DEEPSEEK_MODEL` | "deepseek-chat" | string | ✅ `deepseek_model` |
| E-08 | `deepseekBaseUrl` | `DEEPSEEK_BASE_URL` | "https://api.deepseek.com" | string | ✅ `deepseek_base_url` |
| E-09 | `sessionDays` | `APP_SESSION_DAYS` | 30 | number | ✅ `session_days` |
| E-10 | `smtpHost` | `SMTP_HOST` | "" | string | ✅ `smtp_host` |
| E-11 | `smtpPort` | `SMTP_PORT` | 587 | number | ✅ `smtp_port` |
| E-12 | `smtpUser` | `SMTP_USER` | "" | string | ✅ `smtp_user` |
| E-13 | `smtpPass` | `SMTP_PASS` | "" | secret | ✅ `smtp_pass` |
| E-14 | `smtpFrom` | `SMTP_FROM` | "noreply@thebuddharice.online" | string | ✅ `smtp_from` |
| E-15 | `adminEmails` | `ADMIN_EMAILS` | [] | string[] | ✅ `admin_emails` |
| E-16 | `salesEmail` | `SALES_EMAIL` | "hello@hospios.app" | string | ✅ `sales_email` |
| E-17 | `demoMeetingUrl` | `DEMO_MEETING_URL` | "https://meet.hospios.app/" | string | ✅ `demo_meeting_url` |
| E-18 | `publicRateWindowMs` | `PUBLIC_RATE_WINDOW_MS` | 60000 | number | ✅ `public_rate_window_ms` |
| E-19 | `publicRateMax` | `PUBLIC_RATE_MAX` | 10 | number | ✅ `public_rate_max` |
| E-20 | `adminRateMax` | `ADMIN_RATE_MAX` | 120 | number | ✅ `admin_rate_max` |
| E-21 | `trackViews` | `TRACK_VIEWS` | true | boolean | ✅ `track_views` |
| E-22 | `apifyDatasetId` | `APIFY_DATASET_ID` | "" | string | ✅ `apify_dataset_id` |
| E-23 | `siteUrl` | `NEXT_PUBLIC_SITE_URL` | "https://thebuddharice.online" | string | ❌ (only in `lib/site.ts`) |
| E-24 | `dataProvider` | `DATA_PROVIDER` | "file" | string | ❌ (infra) |
| E-25 | `sessionCookie` | `APP_SESSION_COOKIE` | "hs_session" | string | ❌ (infra) |
| E-26 | `cronSecret` | `CRON_SECRET` | "" | secret | ❌ (infra) |
| E-27 | `affiliateCronKey` | `AFFILIATE_CRON_KEY` | "" | secret | ❌ (infra) |
| E-28 | `allowDemoSeed` | `ALLOW_DEMO_SEED` | "" | string | ❌ (infra) |

### 3C. Hardcoded Configuration Constants (Not Yet Configurable)

| ID | File | Value | Controls | Proposed Key |
|----|------|-------|----------|-------------|
| H-01 | `lib/saas/ticketRules.ts:31` | `4, 8, 24, 72` | SLA hours per priority | `sla_hours_*` (in resolver, not wired) |
| H-02 | `lib/saas/support.ts:90` | `90` days | Open ticket recency | `support_ticket_recency_days` |
| H-03 | `lib/saas/support.ts:38,47` | `3`, `4000` | Ticket validation limits | `ticket_min_subject_length`, `ticket_max_description_length` |
| H-04 | `lib/marketing/scoring.ts:19-47` | 12 point values + 3 thresholds | Scoring rules + bands | `scoring_rule_weights`, `scoring_band_thresholds` |
| H-05 | `lib/marketing/events.ts:32` | `5000` | Max lead events | `marketing_max_lead_events` |
| H-06 | `lib/marketing/forms.ts:252` | `10000` | Max room count | `form_max_room_count` |
| H-07 | `lib/marketing/track.ts:25,26,80` | `100000`, `400`, `30000` | View tracking caps | `marketing_max_page_views`, etc. |
| H-08 | `lib/marketing/guard.ts:125` | `5000` | Rate limiter sweep | `rate_limiter_sweep_threshold` |
| H-09 | `lib/saas/partners.ts:50` | `1500` bps | Partner commission | `partner_default_commission_value` (not wired) |
| H-10 | `lib/saas/franchise.ts:120` | `1500` bps | Franchise rev share | `franchise_default_revenue_share_bps` (not wired) |
| H-11 | `lib/accounts.ts:101` | `30 * 60_000` | Password reset TTL | `password_reset_ttl_ms` |
| H-12 | `lib/saas/automation.ts:22-138` | 10+ timing/threshold values | Automation behavior | `automation_*` (7+ keys) |
| H-13 | `lib/saas/metrics.ts:33-34` | `7`, `30` days | Metric windows | `metrics_short_window_days`, `metrics_long_window_days` |
| H-14 | `lib/saas/health.ts:54-112` | 15+ weight values | Health scoring | `health_score_weights` (JSON) |
| H-15 | `lib/saas/lifecycle.ts:28` | `86_400_000` | Trial expiry skew | `trial_expiry_skew_ms` |
| H-16 | `app/api/auth/login/route.ts:25,38` | `20/60_000`, `8/60_000` | Login rate limits | `auth_login_*_rate_max` |
| H-17 | `app/api/auth/register/route.ts:27` | `5/60_000` | Registration rate limit | `auth_register_rate_max` |
| H-18 | `app/api/auth/password-reset/route.ts:31` | `5/60_000`, `3/60_000` | Password reset rate limits | `auth_password_reset_*_rate_max` |
| H-19 | `lib/marketing/forms.ts:68,372` | `thebuddharice.online` URLs | Email content URLs | Use `SITE_URL` |
| H-20 | `lib/marketing/followups.ts:52` | `thebuddharice.online` fallback | SITE_URL fallback | Use `SITE_URL` |
| H-21 | `lib/marketing/track.ts:32` | `thebuddharice.online` | Self-referrer detection | Use `SITE_URL` |

---

## 4. SETTINGS BACKEND GAP MATRIX

### 4A. Persistence Inconsistencies

| Area | Backend | Problem |
|------|---------|---------|
| Account profile | `lib/db.ts` (file JSON) | Not Prisma; no audit trail |
| Account password | `lib/db.ts` (file JSON) | Not Prisma; no audit trail |
| Account notifications | `lib/db.ts` (file JSON) | Not Prisma; no audit trail |
| Platform settings | Prisma `SystemSetting` | ✅ Consistent |
| Affiliate settings | Prisma `AffiliateSetting` | Separate table from `SystemSetting` |
| Feature flags | Prisma `FeatureFlag` | Separate table, separate API |
| Marketing roles | `lib/marketing/users.ts` (file JSON) | Not Prisma; no audit trail |
| Notification preferences | `lib/db.ts` (file JSON) | Not Prisma; no audit trail |

### 4B. Dual Configuration Paths

| Setting | Path A (legacy) | Path B (resolver) | Problem |
|---------|----------------|-------------------|---------|
| Pricing approval | `lib/saas/settings.ts` key=`require_marketing_pricing_approval` | `lib/settings/resolver.ts` key=`pricing_approval_required` | Two different keys for same toggle |
| SMTP settings | `lib/config.ts` (ENV only) | `lib/settings/resolver.ts` (DB→ENV→default) | `CONFIG` used by some consumers, resolver by others |
| Session days | `lib/config.ts` | `lib/settings/resolver.ts` | Same split |
| All ENV-backed settings | `lib/config.ts` | `lib/settings/resolver.ts` | `config.ts` is the bootstrap path; resolver is the runtime path; both coexist |

### 4C. Missing Backend Capabilities

| Gap | Description | Impact |
|-----|-------------|--------|
| No audit for account APIs | Profile, password, notification pref changes have no audit log | Compliance risk |
| No audit for marketing role changes | Role assignment has marketing audit but not SaaS audit | Compliance risk |
| No setting history/versioning | `SystemSetting` has no history table; `updatedAt` overwritten | Cannot view or rollback changes |
| No setting deletion/reset | SystemSetting has no delete mechanism; must set to default manually | Cannot reset to default |
| No notification delivery engine | Preferences exist but no cron/worker to batch-send emails | Preferences are UI-only |
| No MFA | No multi-factor authentication | Security gap |
| No session management UI | Cannot view/revoke active sessions | Security gap |
| `ticketRules.ts` not wired | SLA hours defined in resolver but hardcoded in ticketRules | Resolver settings have no effect |
| `partners.ts` not wired | Partner commission default defined in resolver but hardcoded | Resolver settings have no effect |
| `franchise.ts` not wired | Franchise rev share defined in resolver but hardcoded | Resolver settings have no effect |
| No timing-safe compare in automation cron | `===` instead of `timingSafeEqual` | Security gap |
| `.env.example` incomplete | Missing 3 env vars used in code | Developer experience gap |
| `ALLOW_DEMO_SEED=1` in `.env.production` | Demo seeding enabled in production | Security concern |

---

## 5. ROLE × SETTINGS ACCESS MATRIX

### 5A. Settings Access by Role

| Setting Area | Super Admin | Platform Admin | Finance | Marketing Admin | Sales Manager | Sales Rep | Support | Analyst | Customer | Affiliate | Partner | Franchise |
|-------------|:-----------:|:--------------:|:-------:|:---------------:|:-------------:|:---------:|:-------:|:-------:|:--------:|:---------:|:-------:|:---------:|
| Platform Settings (pricing, SLA, etc.) | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Security (session, rate limits) | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Email (SMTP config) | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Billing (dunning, grace, trial) | ✅ RW | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Integration (API keys) | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Affiliate Defaults | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Feature Flags | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Marketing Roles | ❌ | ❌ | ❌ | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pricing (plans) | ❌ | ❌ | ✅ R | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Own Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Own Password | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Own Notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 5B. Settings UI Coverage by Role

| Role | Has Personal Settings | Has Security | Has Notifications | Has Org Settings | Has Platform Settings | Has Billing |
|------|:--------------------:|:------------:|:-----------------:|:---------------:|:--------------------:|:-----------:|
| Super Admin | ✅ | ✅ | ✅ | ❌ (N/A) | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ❌ (N/A) | ✅ | ✅ |
| Marketing Admin | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Sales Rep | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Support | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Customer | ✅ | ✅ | ✅ | ❌ (portal exists) | ❌ | ❌ |
| Affiliate | ✅ (portal) | ✅ (portal) | ✅ (portal) | ❌ | ❌ | ❌ |
| Partner | ✅ (portal) | ✅ (portal) | ✅ (portal) | ❌ | ❌ | ❌ |

---

## 6. DUPLICATE SETTINGS IMPLEMENTATIONS

| Duplicate | Instance A | Instance B | Resolution |
|-----------|-----------|-----------|-----------|
| Pricing approval toggle | `lib/saas/settings.ts` (key: `require_marketing_pricing_approval`) | `lib/settings/resolver.ts` (key: `pricing_approval_required`) | Unify to resolver key |
| Site URL | `lib/site.ts` (NEXT_PUBLIC_SITE_URL) | `lib/config.ts` (not present; separate) + hardcoded in 4 files | Single source of truth in resolver |
| SMTP settings | `lib/config.ts` ENV reads | `lib/settings/resolver.ts` DB→ENV reads | CONFIG is bootstrap; resolver is runtime — keep both but wire CONFIG consumers to resolver |
| Rate limits | `lib/config.ts` (publicRateWindowMs, etc.) | `lib/settings/resolver.ts` (same keys) | Wire CONFIG consumers to resolver |
| Affiliate settings table | `AffiliateSetting` Prisma model | `SystemSetting` (affiliate category) | Consolidate to one store |

---

## 7. MISSING ROLE-SPECIFIC SETTINGS EXPERIENCES

| Role | Missing Experience | Priority |
|------|-------------------|----------|
| All users | User preferences page (timezone, date format, dashboard density) | P1 |
| All users | Appearance settings (dark mode, reduced motion) | P2 |
| Super Admin | Users & Teams management page | P1 |
| Super Admin | Roles & Permissions page (view-only reference) | P1 |
| Super Admin | Audit log viewer (exists at `/saas/audit` but not in settings nav) | P2 |
| Super Admin | Email/Integrations settings (nav links exist but no UI) | P1 |
| Finance Admin | Billing profile (invoice email, tax info) | P1 |
| Marketing Admin | CRM defaults (lead routing, stage defaults) | P2 |
| Marketing Admin | Campaign notification settings | P2 |
| Support Agent | Working hours, default queue, availability | P2 |
| Customer | Organization settings (name, timezone, currency) | P1 |
| Customer | Team/user management | P1 |
| Affiliate | Profile, referral settings, payout preferences | P1 |
| Partner | Profile, referral preferences, payout | P1 |

---

## 8. SECURITY-SENSITIVE SETTINGS

| Setting | Current Protection | Gap |
|---------|-------------------|-----|
| `smtp_pass` | DB stored, resolver type=secret | ✅ Adequate |
| `google_places_api_key` | DB stored, resolver type=secret | ✅ Adequate |
| `redis_url` | DB stored, resolver type=secret | ✅ Adequate |
| `deepseek_api_key` | DB stored, resolver type=secret | ✅ Adequate |
| `admin_emails` | DB stored, resolver string | ⚠️ Controls who gets super_admin |
| `ADMIN_EMAILS` env | Legacy fallback in rbac.ts | ⚠️ Dual path — env takes effect instantly |
| `session_days` | DB stored, resolver number | ⚠️ No max session enforcement |
| `CRON_SECRET` | ENV only | ✅ OK (infra) |
| `portal_bindings` | SystemSetting JSON | ⚠️ No access control on internal key |
| `portal_claims` | SystemSetting JSON | ⚠️ No access control on internal key |
| `ALLOW_DEMO_SEED=1` in `.env.production` | ENV | 🔴 Demo seeding enabled in production |
| Password change | File JSON, no audit | 🔴 No audit trail for password changes |
| Profile name change | File JSON, no audit | ⚠️ No audit trail |
| Login rate limits | Hardcoded in route | ⚠️ Not configurable |
| `hs_billing_country` cookie | `document.cookie` (client-readable) | ⚠️ Client-tamperable for pricing |

---

## 9. SETTINGS REQUIRING AUDIT HISTORY

| Setting | Current Audit | Needed |
|---------|--------------|--------|
| All SystemSetting mutations | ✅ `writeSaasAudit` in `/api/settings` | Complete |
| Pricing approval toggle | ✅ `writeSaasAudit` in system-settings API | Complete |
| Feature flag CRUD | ✅ `writeSaasAudit` in feature-flags API | Complete |
| AffiliateSetting mutations | ✅ audit in affiliate-settings API | Complete |
| Plan changes | ✅ `PlanChangeRequest` approval flow | Complete |
| Profile name change | ❌ None | Need audit |
| Password change | ❌ None | Need audit |
| Notification preference change | ❌ None | Need audit |
| Marketing role assignment | ⚠️ Marketing audit only | Need SaaS audit |

---

## 10. SETTINGS REQUIRING BACKEND WORK

| Setting | Backend Gap | Priority |
|---------|-------------|----------|
| MFA | No MFA implementation exists | P1 |
| Active sessions | No session tracking/revocation | P1 |
| Login history | No login audit log | P1 |
| Setting history/versioning | `SystemSetting` has no history | P1 |
| Notification delivery | Preferences exist but no email dispatch engine | P1 |
| User preferences persistence | No Prisma model for user prefs | P2 |
| Appearance preferences | No persistence model | P3 |
| Bulk user operations | No bulk API | P3 |

---

## 11. LOCALSTORAGE / CLIENT-ONLY PREFERENCES

| Key | File | Purpose | Scope |
|-----|------|---------|-------|
| `hospiscore-claimed` | `components/ClaimForm.tsx` | Claimed property IDs | Demo |
| `hs-shell-recent-{planeId}` | `components/shell/CommandPalette.tsx` | Recent navigation (max 5) | Per-plane |
| `hs-shell-rail-{planeId}` | `components/shell/AppShell.tsx` | Sidebar collapsed state | Per-plane |
| `marketing.leadViews` | `components/marketing-admin/SavedViews.tsx` | Saved filter views (JSON) | Per-user |

---

## 12. ENVIRONMENT VARIABLES (COMPLETE)

41 unique `process.env.XXX` references across the codebase. See Section 3B for the complete list with resolver coverage.

**Env vars WITHOUT resolver coverage (infrastructure-only):**
- `DATABASE_URL`, `DATA_PROVIDER`, `APP_DATA_FILE`, `APP_DATA_MIRROR`, `APP_SESSION_COOKIE`, `SQLITE_FILE`, `CRON_SECRET`, `AFFILIATE_CRON_KEY`, `ALLOW_DEMO_SEED`, `PRISMA_QUERY_ENGINE_LIBRARY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `REVIEW_PROVIDER`, `REVIEW_API_KEY`, `REVIEW_BASE_URL`, `CACHE_DISABLED`, `SCORE_HISTORY_DIR`, `ALERT_WEBHOOK_URL`, `NODE_ENV`

---

## 13. SETTINGS THAT SHOULD BECOME ADMIN-CONFIGURABLE

| # | Current Value | Suggested Setting Key | Category | Priority |
|---|--------------|----------------------|----------|----------|
| 1 | `ticketRules.ts` SLA hours (4,8,24,72) | Wire existing `sla_hours_*` | platform | P0 |
| 2 | `partners.ts` default commission (1500) | Wire existing `partner_default_commission_value` | affiliate | P0 |
| 3 | `franchise.ts` default rev share (1500) | Wire existing `franchise_default_revenue_share_bps` | affiliate | P0 |
| 4 | `support.ts` recency window (90 days) | `support_ticket_recency_days` | platform | P1 |
| 5 | `scoring.ts` rule weights | `scoring_rule_weights` (JSON) | platform | P1 |
| 6 | `automation.ts` cooldowns + thresholds | `automation_cooldown_days` (JSON) + individual | platform | P1 |
| 7 | `health.ts` scoring weights | `health_score_weights` (JSON) | platform | P1 |
| 8 | `accounts.ts` password reset TTL | `password_reset_ttl_ms` | security | P1 |
| 9 | Login/register rate limits | `auth_*_rate_max` | security | P1 |
| 10 | `events.ts` retention cap (5000) | `marketing_max_lead_events` | platform | P2 |
| 11 | `track.ts` view caps (100K, 30s dedup) | `marketing_max_page_views`, `marketing_view_dedup_ms` | platform | P2 |
| 12 | `metrics.ts` window sizes (7d, 30d) | `metrics_short_window_days`, `metrics_long_window_days` | platform | P2 |

## 14. SETTINGS THAT SHOULD REMAIN INFRASTRUCTURE-ONLY

| Setting | Reason |
|---------|--------|
| `DATABASE_URL` | Deployment infrastructure; changing at runtime is dangerous |
| `DATA_PROVIDER` | Architectural decision (file vs sqlite) |
| `PRISMA_QUERY_ENGINE_LIBRARY` | Platform-specific binary path |
| `NODE_ENV` | Runtime mode |
| `CRON_SECRET` | Authentication secret |
| `AFFILIATE_CRON_KEY` | Authentication secret |
| `ALLOW_DEMO_SEED` | Safety gate for production |
| `NEXT_PUBLIC_*` | Client-side constants baked at build time |

---

## 15. RECOMMENDED SETTINGS INFORMATION ARCHITECTURE

### Proposed IA (8 top-level sections)

```
Settings
├── Personal
│   ├── Profile (name, email)
│   ├── Preferences (timezone, date format, dashboard)
│   ├── Appearance (dark mode, density)
│   └── Security (password, sessions, MFA [future])
├── Notifications
│   ├── Channel preferences (per event type)
│   └── Notification profiles [future]
├── Organization
│   ├── General (name, country, timezone)
│   ├── Team (users, roles)
│   └── Branding (logo, colors)
├── Operations
│   ├── Support (SLA, priorities, categories)
│   ├── Automation (cooldowns, thresholds)
│   └── Health Scoring (weights, windows)
├── Billing & Subscription
│   ├── Dunning (schedule, grace, suspend)
│   ├── Trial (duration, skew)
│   ├── Usage (overage rates, thresholds)
│   └── Invoice (due days, formatting)
├── Affiliate & Partners
│   ├── Commission (model, value, holding)
│   ├── Fraud (thresholds, weights)
│   ├── Multi-tier (depth, overrides)
│   ├── Payouts (minimum, schedule)
│   └── Partner/Franchise defaults
├── Platform
│   ├── General (approval toggle, admin emails)
│   ├── Security (session, rate limits, portal TTL)
│   ├── Email (SMTP config)
│   ├── Integrations (API keys)
│   ├── Feature Flags (toggle, scope, rollout)
│   └── Metrics (window sizes, retention)
└── Audit
    ├── Settings history [future]
    └── Activity log (/saas/audit)
```

### Settings Precedence Model

```
System default (resolver code default)
    ↓ ENV fallback (if defined)
    ↓ Database override (SystemSetting)
    ↓ (Future) Organization override
    ↓ (Future) Property override
    ↓ (Future) User preference
```

Currently only the first 3 levels exist. Levels 4-6 are future capability.

### Settings Definition Schema

Each setting should declare:

```ts
interface SettingDefinition<T> {
  key: string;
  type: "boolean" | "number" | "string" | "json" | "secret";
  defaultValue: T;
  envFallback?: string;
  description: string;
  category: string;
  scope: "global" | "organization" | "property" | "user";
  permissions: { read: string; write: string };
  validation?: { min?: number; max?: number; options?: string[] };
  sensitive?: boolean;
  requiresConfirmation?: boolean;
  audit?: boolean;
  deprecated?: boolean;
}
```

---

## 16. PHASE COMPLETION STATUS

| Phase | Status | Commit |
|-------|--------|--------|
| Phase A (Audit) | ✅ Complete | This document |
| Phase B (Architecture + Engine) | ✅ Complete | `499ed80` |
| Phase C (Test Coverage) | ✅ Complete | `499ed80` (433 tests) |
| Phase D (Migrations + Settings Panel) | ✅ Complete | `499ed80` |
| Phase E (Personal/Appearance/Preferences) | ❌ Pending | — |
| Phase F (Users/Teams/Roles) | ❌ Pending | — |
| Phase G (Organization/Property) | ❌ Pending | — |
| Phase H (Platform/Billing/Subscription) | ❌ Pending | — |
| Phase I (Affiliate/Partner/Franchise) | ❌ Pending | — |
| Phase J (Advanced/Integrations/Audit/Polish) | ❌ Pending | — |
