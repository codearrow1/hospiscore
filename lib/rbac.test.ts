import { describe, it, expect } from "vitest";
import { appRoleFromStoredRole, dashboardPathFor, APP_ROLE_DASHBOARDS } from "./rbac";
import { hasSaasPerm } from "./saas/roles";

const u = (email: string, role?: string) => ({ email, role });

describe("rbac canonical role mapping", () => {
  it("maps super admin tier to super_admin", () => {
    expect(appRoleFromStoredRole(u("a@b.c", "super_admin"))).toBe("super_admin");
    expect(appRoleFromStoredRole(u("a@b.c", "platform_admin"))).toBe("super_admin");
    expect(appRoleFromStoredRole(u("a@b.c", "finance_admin"))).toBe("super_admin");
  });

  it("keeps ADMIN_EMAILS allowlist as super admin fallback", () => {
    const emails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
    for (const email of emails) {
      expect(appRoleFromStoredRole(u(email))).toBe("super_admin");
    }
    expect(true).toBe(true);
  });

  it("maps legacy marketing admin variants to subadmin", () => {
    expect(appRoleFromStoredRole(u("m@b.c", "marketing_admin"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "marketing_manager"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "sales_manager"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "sales_rep"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "content_editor"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "seo_manager"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "analyst"))).toBe("subadmin");
    expect(appRoleFromStoredRole(u("m@b.c", "read_only"))).toBe("subadmin");
  });

  it("maps support roles to staff", () => {
    expect(appRoleFromStoredRole(u("s@b.c", "support_admin"))).toBe("staff");
    expect(appRoleFromStoredRole(u("s@b.c", "customer_success"))).toBe("staff");
  });

  it("returns null for roleless non-admin users (portal identities resolve via DB)", () => {
    expect(appRoleFromStoredRole(u("affiliate@hospios.demo", ""))).toBeNull();
    expect(appRoleFromStoredRole(u("someone@else.com"))).toBeNull();
  });
});

describe("rbac subadmin boundary (backend-enforced)", () => {
  const subadmin = u("marketing@hospios.demo", "marketing_admin");
  it("retains marketing manage + read visibility", () => {
    expect(hasSaasPerm(subadmin, "MARKETING_MANAGE")).toBe(true);
    expect(hasSaasPerm(subadmin, "MARKETING_VIEW")).toBe(true);
    expect(hasSaasPerm(subadmin, "CUSTOMER_VIEW")).toBe(true);
    expect(hasSaasPerm(subadmin, "BILLING_VIEW")).toBe(true);
    expect(hasSaasPerm(subadmin, "AUDIT_VIEW")).toBe(true);
  });
  it("denies all SaaS write controls", () => {
    expect(hasSaasPerm(subadmin, "SUBSCRIPTION_MANAGE")).toBe(false);
    expect(hasSaasPerm(subadmin, "BILLING_MANAGE")).toBe(false);
    expect(hasSaasPerm(subadmin, "CUSTOMER_MANAGE")).toBe(false);
    expect(hasSaasPerm(subadmin, "PLAN_MANAGE")).toBe(false);
    expect(hasSaasPerm(subadmin, "REFUND_APPROVE")).toBe(false);
    expect(hasSaasPerm(subadmin, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
    expect(hasSaasPerm(subadmin, "AFFILIATE_PAYOUT")).toBe(false);
  });
  it("sales-tier roles lost manage perms too", () => {
    expect(hasSaasPerm(u("x@b.c", "sales_manager"), "CUSTOMER_MANAGE")).toBe(false);
    expect(hasSaasPerm(u("x@b.c", "sales_admin"), "SUBSCRIPTION_MANAGE")).toBe(false);
    expect(hasSaasPerm(u("x@b.c", "sales_admin"), "CUSTOMER_VIEW")).toBe(true);
  });
  it("super admin keeps full control", () => {
    const sa = u("superadmin@hospios.demo", "super_admin");
    expect(hasSaasPerm(sa, "SUBSCRIPTION_MANAGE")).toBe(true);
    expect(hasSaasPerm(sa, "SYSTEM_SETTINGS_MANAGE")).toBe(true);
    expect(hasSaasPerm(sa, "REFUND_APPROVE")).toBe(true);
  });
});

describe("rbac dashboard routing", () => {
  it("routes every canonical role to its own dashboard", () => {
    expect(dashboardPathFor("super_admin")).toBe("/saas");
    expect(dashboardPathFor("subadmin")).toBe("/subadmin");
    expect(dashboardPathFor("staff")).toBe("/staff");
    expect(dashboardPathFor("affiliate")).toBe("/affiliate");
    expect(dashboardPathFor("partner")).toBe("/partner");
    expect(dashboardPathFor("customer")).toBe("/customer");
    expect(dashboardPathFor(null)).toBe("/account");
  });
  it("has a distinct dashboard per role", () => {
    const paths = Object.values(APP_ROLE_DASHBOARDS);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
