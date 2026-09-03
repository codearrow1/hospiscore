import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSettingDefinitions,
  getSettingDefinition,
  resolveSetting,
  resolveSettings,
  resolveSettingsByCategory,
} from "./resolver";

const mockFindUnique = vi.fn().mockResolvedValue(null);
const mockFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

describe("settings resolver — getSettingDefinitions", () => {
  it("returns all definitions", () => {
    const defs = getSettingDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(40);
  });

  it("each definition has required fields", () => {
    for (const def of getSettingDefinitions()) {
      expect(def.key).toBeTruthy();
      expect(def.type).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.defaultValue).toBeDefined();
    }
  });

  it("covers all 7 categories", () => {
    const cats = new Set(getSettingDefinitions().map((d) => d.category));
    expect(cats.size).toBe(7);
    for (const c of ["platform", "security", "email", "billing", "affiliate", "integration", "analytics"]) {
      expect(cats.has(c as never)).toBe(true);
    }
  });
});

describe("settings resolver — getSettingDefinition", () => {
  it("returns definition for known key", () => {
    const def = getSettingDefinition("pricing_approval_required");
    expect(def).toBeDefined();
    expect(def!.type).toBe("boolean");
    expect(def!.category).toBe("platform");
  });

  it("returns undefined for unknown key", () => {
    expect(getSettingDefinition("nonexistent_key")).toBeUndefined();
  });
});

describe("settings resolver — resolveSetting (default/ENV fallback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TEST_FALLBACK_ENV;
    delete process.env.SALES_EMAIL;
    delete process.env.APP_SESSION_DAYS;
  });

  it("returns default when no DB row and no ENV", async () => {
    const val = await resolveSetting<number>("session_days");
    expect(val).toBe(30); // code default
  });

  it("returns boolean default", async () => {
    const val = await resolveSetting<boolean>("pricing_approval_required");
    expect(val).toBe(true);
  });

  it("returns json default", async () => {
    const val = await resolveSetting<number[]>("dunning_retry_schedule");
    expect(val).toEqual([1, 3, 5, 7]);
  });

  it("returns number default", async () => {
    const val = await resolveSetting<number>("min_payout_cents");
    expect(val).toBe(5000);
  });

  it("throws on unknown key", async () => {
    await expect(resolveSetting("bogus_key")).rejects.toThrow("Unknown setting");
  });

  it("uses ENV fallback when available", async () => {
    process.env.SALES_EMAIL = "custom@env.com";
    const val = await resolveSetting<string>("sales_email");
    expect(val).toBe("custom@env.com");
  });

  it("prefers ENV fallback over default", async () => {
    process.env.APP_SESSION_DAYS = "60";
    const val = await resolveSetting<number>("session_days");
    expect(val).toBe(60);
  });
});

describe("settings resolver — resolveSetting (DB override)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SALES_EMAIL;
    delete process.env.APP_SESSION_DAYS;
  });

  it("DB value takes priority over ENV and default", async () => {
    process.env.SALES_EMAIL = "env@fallback.com";
    mockFindUnique.mockResolvedValueOnce({ key: "sales_email", value: { value: "db@override.com" } });

    const val = await resolveSetting<string>("sales_email");
    expect(val).toBe("db@override.com");
  });

  it("DB value takes priority over default (no ENV)", async () => {
    mockFindUnique.mockResolvedValueOnce({ key: "session_days", value: { value: 90 } });

    const val = await resolveSetting<number>("session_days");
    expect(val).toBe(90);
  });

  it("falls back to default when DB findUnique throws", async () => {
    mockFindUnique.mockRejectedValueOnce(new Error("table missing"));

    const val = await resolveSetting<boolean>("pricing_approval_required");
    expect(val).toBe(true);
  });
});

describe("settings resolver — resolveSettings (batch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SALES_EMAIL;
    delete process.env.APP_SESSION_DAYS;
  });

  it("resolves multiple keys with a single DB call", async () => {
    mockFindMany.mockResolvedValueOnce([
      { key: "session_days", value: { value: 60 } },
      { key: "pricing_approval_required", value: { value: false } },
    ]);

    const result = await resolveSettings<{ session_days: number; pricing_approval_required: boolean }>([
      "session_days",
      "pricing_approval_required",
    ]);
    expect(result.session_days).toBe(60);
    expect(result.pricing_approval_required).toBe(false);
    expect(mockFindMany).toHaveBeenCalledOnce();
  });

  it("uses defaults for missing DB rows", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await resolveSettings<{ session_days: number; min_payout_cents: number }>([
      "session_days",
      "min_payout_cents",
    ]);
    expect(result.session_days).toBe(30);
    expect(result.min_payout_cents).toBe(5000);
  });

  it("silently ignores unknown keys", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await resolveSettings<{ session_days: number; [k: string]: unknown }>([
      "session_days",
      "totally_fake_key",
    ]);
    expect(result.session_days).toBe(30);
    expect(result.totally_fake_key).toBeUndefined();
  });
});

describe("settings resolver — resolveSettingsByCategory", () => {
  beforeEach(() => {
    delete process.env.SALES_EMAIL;
    delete process.env.APP_SESSION_DAYS;
  });
  it("returns all billing settings", async () => {
    const result = await resolveSettingsByCategory("billing");
    expect(result).toHaveProperty("dunning_retry_schedule");
    expect(result).toHaveProperty("dunning_max_attempts");
    expect(result).toHaveProperty("past_due_grace_days");
    expect(result).toHaveProperty("suspend_after_days");
    expect(result).toHaveProperty("trial_duration_days");
    expect(result).toHaveProperty("usage_invoice_due_days");
  });

  it("returns all affiliate settings", async () => {
    const result = await resolveSettingsByCategory("affiliate");
    expect(result).toHaveProperty("affiliate_cookie_days");
    expect(result).toHaveProperty("min_payout_cents");
    expect(result).toHaveProperty("fraud_should_flag_threshold");
    expect(result).toHaveProperty("max_tier_depth");
    expect(result).toHaveProperty("recurring_duration_months");
    expect(result).toHaveProperty("holding_period_days");
  });

  it("returns all platform settings", async () => {
    const result = await resolveSettingsByCategory("platform");
    expect(result).toHaveProperty("pricing_approval_required");
    expect(result).toHaveProperty("sales_email");
    expect(result).toHaveProperty("sla_hours_urgent");
    expect(result).toHaveProperty("sla_hours_high");
    expect(result).toHaveProperty("sla_hours_medium");
    expect(result).toHaveProperty("sla_hours_low");
    expect(result).toHaveProperty("health_payment_window_days");
  });

  it("returns security settings including portal_claim_ttl_ms", async () => {
    const result = await resolveSettingsByCategory("security");
    expect(result).toHaveProperty("session_days");
    expect(result).toHaveProperty("portal_claim_ttl_ms");
    expect(result.portal_claim_ttl_ms).toBe(900000);
  });
});

describe("settings resolver — new definition defaults", () => {
  it("SLA hours have correct defaults", async () => {
    expect(await resolveSetting("sla_hours_urgent")).toBe(4);
    expect(await resolveSetting("sla_hours_high")).toBe(8);
    expect(await resolveSetting("sla_hours_medium")).toBe(24);
    expect(await resolveSetting("sla_hours_low")).toBe(72);
  });

  it("health and portal defaults are correct", async () => {
    expect(await resolveSetting("health_payment_window_days")).toBe(90);
    expect(await resolveSetting("portal_claim_ttl_ms")).toBe(900000);
    expect(await resolveSetting("recurring_duration_months")).toBe(12);
    expect(await resolveSetting("partner_default_commission_value")).toBe(1500);
    expect(await resolveSetting("franchise_default_revenue_share_bps")).toBe(1500);
  });

  it("org default settings have correct defaults", async () => {
    expect(await resolveSetting("org_default_country")).toBe("");
    expect(await resolveSetting("org_default_currency")).toBe("USD");
    expect(await resolveSetting("org_default_timezone")).toBe("UTC");
  });
});
