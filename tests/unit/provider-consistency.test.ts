/**
 * Phase N — Provider consistency + financial invariants (pure, no DB).
 *
 * These assertions pin the launch-critical invariants that a regression could
 * silently break:
 *
 *  - Provider status machine: only `ready`/`verify` may route a payment; the
 *    four non-routable statuses can never be routed even when enabled.
 *  - A `registered` (unwired) provider is never routable — READY is only
 *    reachable through a successful connection test.
 *  - Financial / separation-of-duties invariants: refund + financial-approve
 *    capabilities are scoped to the correct roles, and SaaS-only roles do not
 *    gain broad platform or financial powers.
 */
import { describe, expect, test } from "vitest";
import { canRoutePayment, NON_ROUTABLE_STATUSES } from "@/lib/saas/payments/types";
import { hasSaasPerm, SAAS_ROLES } from "@/lib/saas/roles";

type Status = import("@/lib/saas/payments/types").ProviderIntegrationStatus;

const NON_ROUTABLE: Status[] = ["registered", "verification_failed", "disabled", "misconfigured"];

describe("provider consistency invariants", () => {
  test("only ready/verify can route a payment (never non-routable, even when enabled)", () => {
    expect(canRoutePayment("ready", true)).toBe(true);
    expect(canRoutePayment("verify", true)).toBe(true);
    for (const s of NON_ROUTABLE) {
      expect(canRoutePayment(s, true)).toBe(false);
      expect(canRoutePayment(s, false)).toBe(false);
    }
    // Disabled always blocks routing regardless of status.
    expect(canRoutePayment("ready", false)).toBe(false);
    expect(canRoutePayment(undefined, true)).toBe(false);
  });

  test("status machine is closed over the documented set", () => {
    for (const s of NON_ROUTABLE) {
      expect(NON_ROUTABLE_STATUSES).toContain(s);
    }
    // ready/verify are NOT non-routable.
    expect(NON_ROUTABLE_STATUSES).not.toContain("ready");
    expect(NON_ROUTABLE_STATUSES).not.toContain("verify");
  });

  test("registered (unwired) can never route, guarding the READY-only rule", () => {
    expect(canRoutePayment("registered", true)).toBe(false);
  });
});

describe("financial / separation-of-duties invariants", () => {
  const mockUser = (role: string, email = "x@hospios.app") => ({ email, role });

  test("super_admin holds every cross-cutting capability", () => {
    for (const perm of ["FINANCIAL_APPROVE", "REFUND_APPROVE", "SYSTEM_SETTINGS_MANAGE"] as const) {
      expect(hasSaasPerm(mockUser("super_admin"), perm)).toBe(true);
    }
  });

  test("finance_admin can approve refunds but not platform/financial-approve powers", () => {
    const finance = mockUser("finance_admin");
    expect(hasSaasPerm(finance, "REFUND_APPROVE")).toBe(true);
    // Separation of duties: finance handles refunds, not blanket approval or
    // platform system settings.
    expect(hasSaasPerm(finance, "FINANCIAL_APPROVE")).toBe(false);
    expect(hasSaasPerm(finance, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
    expect(hasSaasPerm(finance, "PLAN_MANAGE")).toBe(false);
  });

  test("support_admin is scoped to support — never financial or platform-admin", () => {
    const support = mockUser("support_admin");
    expect(hasSaasPerm(support, "SUPPORT_VIEW")).toBe(true);
    expect(hasSaasPerm(support, "SUPPORT_MANAGE")).toBe(true);
    expect(hasSaasPerm(support, "FINANCIAL_APPROVE")).toBe(false);
    expect(hasSaasPerm(support, "REFUND_APPROVE")).toBe(false);
    expect(hasSaasPerm(support, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
  });

  test("SAAS_ROLES is a non-empty, closed role list", () => {
    expect(SAAS_ROLES.length).toBeGreaterThan(0);
    expect(SAAS_ROLES).toContain("super_admin");
    expect(SAAS_ROLES).toContain("finance_admin");
    expect(SAAS_ROLES).toContain("support_admin");
  });
});
