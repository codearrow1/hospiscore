/**
 * Settings Resolution Engine — Phase B
 *
 * Provides dual-read resolution: SystemSetting (database) → ENV fallback.
 * All platform settings flow through this engine to ensure:
 * 1. Database overrides take precedence over ENV
 * 2. ENV values serve as fallback for bootstrapping
 * 3. Type-safe access with validation
 * 4. Audit trail for all mutations
 */
import { prisma } from "@/lib/prisma";

export type SettingType = "string" | "number" | "boolean" | "json" | "secret";

export interface SettingDefinition {
  key: string;
  type: SettingType;
  defaultValue: unknown;
  envFallback?: string;
  description: string;
  category: "platform" | "security" | "email" | "billing" | "affiliate" | "integration" | "analytics";
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  /** When true, the value is read directly from server environment variables at runtime and DB edits do not affect behavior. */
  envManaged?: boolean;
}

const SETTING_DEFINITIONS: SettingDefinition[] = [
  // Platform
  { key: "pricing_approval_required", type: "boolean", defaultValue: true, description: "Require approval for pricing changes", category: "platform" },
  { key: "admin_emails", type: "string", defaultValue: "", envFallback: "ADMIN_EMAILS", description: "Comma-separated admin email addresses", category: "platform", envManaged: true },
  { key: "sales_email", type: "string", defaultValue: "hello@hospios.app", envFallback: "SALES_EMAIL", description: "Default sales contact email", category: "platform", envManaged: true },
  { key: "demo_meeting_url", type: "string", defaultValue: "https://meet.hospios.app/", envFallback: "DEMO_MEETING_URL", description: "Demo meeting base URL", category: "platform", envManaged: true },

  // Security
  { key: "session_days", type: "number", defaultValue: 30, envFallback: "APP_SESSION_DAYS", description: "Session lifetime in days", category: "security", min: 1, max: 365, envManaged: true },
  { key: "public_rate_window_ms", type: "number", defaultValue: 60000, envFallback: "PUBLIC_RATE_WINDOW_MS", description: "Public API rate limit window (ms)", category: "security", min: 1000, envManaged: true },
  { key: "public_rate_max", type: "number", defaultValue: 10, envFallback: "PUBLIC_RATE_MAX", description: "Max public API requests per window", category: "security", min: 1, envManaged: true },
  { key: "admin_rate_max", type: "number", defaultValue: 120, envFallback: "ADMIN_RATE_MAX", description: "Max admin API requests per minute", category: "security", min: 1, envManaged: true },

  // Email
  { key: "smtp_host", type: "string", defaultValue: "", envFallback: "SMTP_HOST", description: "SMTP server hostname", category: "email", envManaged: true },
  { key: "smtp_port", type: "number", defaultValue: 587, envFallback: "SMTP_PORT", description: "SMTP server port", category: "email", min: 1, max: 65535, envManaged: true },
  { key: "smtp_user", type: "string", defaultValue: "", envFallback: "SMTP_USER", description: "SMTP username", category: "email", envManaged: true },
  { key: "smtp_pass", type: "secret", defaultValue: "", envFallback: "SMTP_PASS", description: "SMTP password", category: "email", envManaged: true },
  { key: "smtp_from", type: "string", defaultValue: "noreply@thebuddharice.online", envFallback: "SMTP_FROM", description: "Sender email address", category: "email", envManaged: true },

  // Billing
  { key: "dunning_retry_schedule", type: "json", defaultValue: [1, 3, 5, 7], description: "Dunning retry intervals in days", category: "billing" },
  { key: "dunning_max_attempts", type: "number", defaultValue: 4, description: "Maximum dunning retry attempts", category: "billing", min: 1, max: 10 },
  { key: "past_due_grace_days", type: "number", defaultValue: 3, description: "Grace period before past due", category: "billing", min: 1, max: 30 },
  { key: "suspend_after_days", type: "number", defaultValue: 10, description: "Days before suspension", category: "billing", min: 1, max: 90 },
  { key: "trial_duration_days", type: "number", defaultValue: 14, description: "Trial period in days", category: "billing", min: 1, max: 90 },
  { key: "usage_invoice_due_days", type: "number", defaultValue: 14, description: "Usage invoice due in days", category: "billing", min: 1, max: 60 },

  // Affiliate
  { key: "affiliate_cookie_days", type: "number", defaultValue: 30, description: "Attribution cookie lifetime", category: "affiliate", min: 1, max: 365 },
  { key: "affiliate_commission_model", type: "string", defaultValue: "percent_mrr_12", description: "Default commission model", category: "affiliate", options: ["fixed", "percent_first", "percent_mrr_12", "percent_mrr_recurring"] },
  { key: "affiliate_commission_value", type: "number", defaultValue: 2000, description: "Default commission value (cents/bps)", category: "affiliate", min: 0 },
  { key: "holding_period_days", type: "number", defaultValue: 30, description: "Commission holding period", category: "affiliate", min: 0, max: 365 },
  { key: "min_payout_cents", type: "number", defaultValue: 5000, description: "Minimum payout threshold (cents)", category: "affiliate", min: 0 },
  { key: "fraud_threshold", type: "number", defaultValue: 60, description: "Fraud detection threshold", category: "affiliate", min: 0, max: 100 },
  { key: "max_tier_depth", type: "number", defaultValue: 3, description: "Maximum multi-tier levels", category: "affiliate", min: 0, max: 5 },
  { key: "fraud_should_flag_threshold", type: "number", defaultValue: 50, description: "Risk score threshold for flagging", category: "affiliate", min: 0, max: 100 },
  { key: "fraud_no_conversion_clicks", type: "number", defaultValue: 100, description: "Clicks before no-conversion signal", category: "affiliate", min: 10 },
  { key: "fraud_low_conversion_ratio", type: "number", defaultValue: 200, description: "Click/conversion ratio threshold", category: "affiliate", min: 10 },
  { key: "fraud_ip_concentration_threshold", type: "number", defaultValue: 50, description: "IP click concentration threshold", category: "affiliate", min: 10 },
  { key: "fraud_immediate_cancellation_days", type: "number", defaultValue: 7, description: "Days for immediate cancellation signal", category: "affiliate", min: 1, max: 30 },
  { key: "fraud_signal_weights", type: "json", defaultValue: { self_referral: 80, no_conversions: 30, low_conversion: 20, immediate_cancel: 50, ip_concentration: 25 }, description: "Fraud signal weights", category: "affiliate" },

  // Integration
  { key: "google_places_api_key", type: "secret", defaultValue: "", envFallback: "GOOGLE_PLACES_API_KEY", description: "Google Places API key", category: "integration", envManaged: true },
  { key: "deepseek_api_key", type: "secret", defaultValue: "", envFallback: "DEEPSEEK_API_KEY", description: "DeepSeek API key", category: "integration", envManaged: true },
  { key: "deepseek_model", type: "string", defaultValue: "deepseek-chat", envFallback: "DEEPSEEK_MODEL", description: "DeepSeek model name", category: "integration", envManaged: true },
  { key: "deepseek_base_url", type: "string", defaultValue: "https://api.deepseek.com", envFallback: "DEEPSEEK_BASE_URL", description: "DeepSeek API base URL", category: "integration", envManaged: true },
  { key: "apify_dataset_id", type: "string", defaultValue: "", envFallback: "APIFY_DATASET_ID", description: "Apify dataset ID", category: "integration", envManaged: true },
  { key: "apify_base_url", type: "string", defaultValue: "https://api.apify.com", envFallback: "APIFY_BASE_URL", description: "Apify API base URL", category: "integration", envManaged: true },
  { key: "redis_url", type: "secret", defaultValue: "", envFallback: "REDIS_URL", description: "Redis connection URL", category: "integration", envManaged: true },
  { key: "cache_provider", type: "string", defaultValue: "memory", envFallback: "CACHE_PROVIDER", description: "Cache provider type", category: "integration", options: ["memory", "redis"], envManaged: true },

  // Analytics
  { key: "track_views", type: "boolean", defaultValue: true, envFallback: "TRACK_VIEWS", description: "Enable anonymous page view tracking", category: "analytics", envManaged: true },

  // SLA (support)
  { key: "sla_hours_urgent", type: "number", defaultValue: 4, description: "SLA target hours for urgent tickets", category: "platform", min: 1, max: 48 },
  { key: "sla_hours_high", type: "number", defaultValue: 8, description: "SLA target hours for high-priority tickets", category: "platform", min: 1, max: 72 },
  { key: "sla_hours_medium", type: "number", defaultValue: 24, description: "SLA target hours for medium-priority tickets", category: "platform", min: 1, max: 168 },
  { key: "sla_hours_low", type: "number", defaultValue: 72, description: "SLA target hours for low-priority tickets", category: "platform", min: 1, max: 336 },

  // Health scoring
  { key: "health_payment_window_days", type: "number", defaultValue: 90, description: "Lookback window for payment failure signals", category: "platform", min: 7, max: 365 },

  // Portal security
  { key: "portal_claim_ttl_ms", type: "number", defaultValue: 900000, description: "Portal claim token TTL in ms (15 min)", category: "security", min: 60000, max: 7200000 },

  // Multi-tier
  { key: "recurring_duration_months", type: "number", defaultValue: 12, description: "Default recurring commission duration in months", category: "affiliate", min: 1, max: 60 },

  // Partner defaults
  { key: "partner_default_commission_value", type: "number", defaultValue: 1500, description: "Default partner commission value (bps)", category: "affiliate", min: 0 },

  // Franchise defaults
  { key: "franchise_default_revenue_share_bps", type: "number", defaultValue: 1500, description: "Default franchise revenue share (bps)", category: "affiliate", min: 0 },

  // Organization defaults
  { key: "org_default_country", type: "string", defaultValue: "", description: "Default country for new organizations (ISO2)", category: "platform" },
  { key: "org_default_currency", type: "string", defaultValue: "USD", description: "Default billing currency for new subscriptions", category: "platform", options: ["USD", "EUR", "GBP", "INR", "ZAR", "AED"] },
  { key: "org_default_timezone", type: "string", defaultValue: "UTC", description: "Default timezone for new organizations", category: "platform" },
];

export function getSettingDefinitions(): SettingDefinition[] {
  return SETTING_DEFINITIONS;
}

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find(d => d.key === key);
}

export function isEnvManagedSetting(key: string): boolean {
  return getSettingDefinition(key)?.envManaged === true;
}

/**
 * Resolve a setting value with priority: Database → ENV → Default.
 * Type-safe with validation.
 */
export async function resolveSetting<T = unknown>(key: string): Promise<T> {
  const def = getSettingDefinition(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);

  // 1. Try database (SystemSetting)
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row) {
      const raw = (row.value as { value?: unknown })?.value ?? row.value;
      return coerceValue(raw, def.type) as T;
    }
  } catch {
    // Table may not exist yet
  }

  // 2. Try ENV fallback
  if (def.envFallback) {
    const envVal = process.env[def.envFallback]?.trim();
    if (envVal !== undefined && envVal !== "") {
      return coerceValue(envVal, def.type) as T;
    }
  }

  // 3. Return default
  return def.defaultValue as T;
}

/**
 * Resolve multiple settings at once (reduces DB queries).
 */
export async function resolveSettings<T extends Record<string, unknown>>(keys: string[]): Promise<T> {
  const result = {} as T;

  // Batch fetch from database
  const dbSettings: Map<string, unknown> = new Map();
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });
    for (const row of rows) {
      const raw = (row.value as { value?: unknown })?.value ?? row.value;
      dbSettings.set(row.key, raw);
    }
  } catch {
    // Table may not exist yet
  }

  // Resolve each key
  for (const key of keys) {
    const def = getSettingDefinition(key);
    if (!def) continue;

    // Priority: Database → ENV → Default
    if (dbSettings.has(key)) {
      (result as Record<string, unknown>)[key] = coerceValue(dbSettings.get(key), def.type);
    } else if (def.envFallback) {
      const envVal = process.env[def.envFallback]?.trim();
      if (envVal !== undefined && envVal !== "") {
        (result as Record<string, unknown>)[key] = coerceValue(envVal, def.type);
      } else {
        (result as Record<string, unknown>)[key] = def.defaultValue;
      }
    } else {
      (result as Record<string, unknown>)[key] = def.defaultValue;
    }
  }

  return result;
}

/**
 * Update a setting in the database.
 */
export async function updateSetting(
  key: string,
  value: unknown,
  updatedByEmail: string,
): Promise<void> {
  const def = getSettingDefinition(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);

  const validated = validateValue(value, def);
  const coerced = coerceValue(validated, def.type);

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: { value: coerced } as never, updatedByEmail, updatedAt: new Date() },
    create: { key, value: { value: coerced } as never, updatedByEmail },
  });
}

/**
 * Update multiple settings at once.
 */
export async function updateSettings(
  updates: Array<{ key: string; value: unknown }>,
  updatedByEmail: string,
): Promise<void> {
  for (const { key, value } of updates) {
    await updateSetting(key, value, updatedByEmail);
  }
}

/**
 * Validate a setting value against its definition.
 */
function validateValue(value: unknown, def: SettingDefinition): unknown {
  if (value === null || value === undefined) {
    if (def.required) throw new Error(`${def.key} is required`);
    return def.defaultValue;
  }

  switch (def.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new Error(`${def.key} must be a number`);
      if (def.min !== undefined && n < def.min) throw new Error(`${def.key} must be >= ${def.min}`);
      if (def.max !== undefined && n > def.max) throw new Error(`${def.key} must be <= ${def.max}`);
      return n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
      throw new Error(`${def.key} must be a boolean`);
    }
    case "string": {
      const s = String(value).trim();
      if (def.required && !s) throw new Error(`${def.key} is required`);
      if (def.options && !def.options.includes(s)) {
        throw new Error(`${def.key} must be one of: ${def.options.join(", ")}`);
      }
      return s;
    }
    case "json": {
      if (typeof value === "string") {
        try { return JSON.parse(value); } catch { throw new Error(`${def.key} must be valid JSON`); }
      }
      return value;
    }
    case "secret": {
      return String(value);
    }
    default:
      return value;
  }
}

/**
 * Coerce a raw value to the target type.
 */
function coerceValue(value: unknown, type: SettingType): unknown {
  if (value === null || value === undefined) return value;

  switch (type) {
    case "number": {
      if (typeof value === "number") return value;
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      return value === "true" || value === "1";
    }
    case "string":
      return String(value);
    case "json":
      if (typeof value === "string") {
        try { return JSON.parse(value); } catch { return value; }
      }
      return value;
    case "secret":
      return String(value);
    default:
      return value;
  }
}

/**
 * Get all settings for a category.
 */
export async function resolveSettingsByCategory(category: SettingDefinition["category"]): Promise<Record<string, unknown>> {
  const keys = SETTING_DEFINITIONS
    .filter(d => d.category === category)
    .map(d => d.key);
  return resolveSettings(keys);
}
