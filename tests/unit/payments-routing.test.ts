/**
 * Routing validation (Phase L) — unit tests for lib/saas/payments/routing.ts.
 * These assert the editor's warnings match what the runtime router does so the
 * admin UI never shows a configuration that would silently misroute.
 */
import { describe, it, expect } from "vitest";
import { validateRouting } from "@/lib/saas/payments/routing";
import type { ProviderConfig } from "@/lib/saas/payments/types";

function cfg(partial: Partial<ProviderConfig> & { id: string }): ProviderConfig {
  return {
    id: partial.id,
    label: partial.label ?? partial.id,
    integrationStatus: partial.integrationStatus ?? "registered",
    family: partial.family ?? "fiat",
    enabled: partial.enabled ?? false,
    isDefault: partial.isDefault ?? false,
    priority: partial.priority ?? 100,
    mode: partial.mode ?? "test",
    countries: partial.countries ?? [],
    currencies: partial.currencies ?? [],
    methods: partial.methods ?? [],
    capabilities: partial.capabilities ?? [],
    fees: partial.fees ?? { default: undefined, byCurrency: {} },
    credentials: partial.credentials ?? {},
    webhookPath: partial.webhookPath ?? `/api/payments/webhook/${partial.id}`,
    health: partial.health ?? { healthy: false, lastCheckedAt: null, lastError: null, successRate: null, consecutiveFailures: 0 },
  };
}

const ready = (id: string, over: Partial<ProviderConfig> = {}) =>
  cfg({ id, label: id, integrationStatus: "ready", enabled: true, priority: 10, ...over });

describe("validateRouting", () => {
  it("reports nothing when a single ready provider is routed", () => {
    const issues = validateRouting([ready("stripe")]);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("flags a default provider that is not routable", () => {
    const issues = validateRouting([
      ready("stripe"),
      cfg({ id: "paytm", integrationStatus: "verifying", enabled: true, isDefault: true, priority: 5 }),
    ]);
    expect(issues.some((i) => i.code === "DEFAULT_NOT_ROUTABLE" && i.providerId === "paytm")).toBe(true);
  });

  it("flags multiple default providers", () => {
    const issues = validateRouting([
      ready("stripe", { isDefault: true }),
      ready("paypal", { isDefault: true }),
    ]);
    expect(issues.some((i) => i.code === "MULTIPLE_DEFAULTS")).toBe(true);
  });

  it("flags duplicate priorities among routable providers", () => {
    const issues = validateRouting([
      ready("stripe", { priority: 5 }),
      ready("paypal", { priority: 5 }),
    ]);
    expect(issues.some((i) => i.code === "DUPLICATE_PRIORITY")).toBe(true);
  });

  it("warns when an enabled provider cannot be routed", () => {
    const issues = validateRouting([
      ready("stripe"),
      cfg({ id: "mollie", integrationStatus: "verification_failed", enabled: true, priority: 5 }),
    ]);
    expect(issues.some((i) => i.code === "ENABLED_NOT_ROUTABLE" && i.providerId === "mollie")).toBe(true);
  });

  it("errors when no provider is both enabled and ready", () => {
    const issues = validateRouting([
      cfg({ id: "stripe", integrationStatus: "verifying", enabled: true, priority: 5 }),
    ]);
    expect(issues.some((i) => i.code === "NO_ROUTABLE_PROVIDER")).toBe(true);
  });

  it("warns when routing exists but no default is set", () => {
    const issues = validateRouting([
      ready("stripe"),
      ready("paypal"),
    ]);
    expect(issues.some((i) => i.code === "NO_DEFAULT")).toBe(true);
  });

  it("does not warn about a missing default when one is present", () => {
    const issues = validateRouting([
      ready("stripe", { isDefault: true }),
      ready("paypal"),
    ]);
    expect(issues.some((i) => i.code === "NO_DEFAULT")).toBe(false);
  });
});
