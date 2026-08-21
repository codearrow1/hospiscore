import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appRoleFromStoredRole, dashboardPathFor, APP_ROLE_DASHBOARDS } from "./rbac";
import { hasSaasPerm } from "./saas/roles";
import { ensureDemoUsers } from "./marketing/seed";
import { readData } from "./db";
import { verifyPassword } from "./auth";

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

describe("rbac staff boundary", () => {
  const staff = u("staff@hospios.demo", "support_admin");
  it("allows support operations", () => {
    expect(hasSaasPerm(staff, "SUPPORT_VIEW")).toBe(true);
    expect(hasSaasPerm(staff, "SUPPORT_MANAGE")).toBe(true);
    expect(hasSaasPerm(staff, "CUSTOMER_VIEW")).toBe(true);
  });
  it("denies privileged billing and system configuration", () => {
    expect(hasSaasPerm(staff, "BILLING_MANAGE")).toBe(false);
    expect(hasSaasPerm(staff, "REFUND_APPROVE")).toBe(false);
    expect(hasSaasPerm(staff, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
    expect(hasSaasPerm(staff, "PLAN_MANAGE")).toBe(false);
    expect(hasSaasPerm(staff, "SUBSCRIPTION_MANAGE")).toBe(false);
  });
});

describe("rbac demo credentials authenticate", () => {
  const accounts: [string, string][] = [
    ["superadmin@hospios.demo", "Hospios@Demo2026!"],
    ["marketing@hospios.demo", "Marketing@Demo2026!"],
    ["affiliate@hospios.demo", "Affiliate@Demo2026!"],
    ["partner@hospios.demo", "Partner@Demo2026!"],
    ["customer@hospios.demo", "Customer@Demo2026!"],
    ["customer2@hospios.demo", "Customer2@Demo2026!"],
    ["staff@hospios.demo", "Staff@Demo2026!"],
  ];

  it("creates every role user with a working password hash", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "hs-rbac-"));
    const target = path.join(dir, "data.json");
    await ensureDemoUsers(target);
    const data = await readData(target);
    for (const [email, password] of accounts) {
      const user = data.users.find((x) => x.email === email && x.passwordHash);
      expect(user, `missing demo user ${email}`).toBeTruthy();
      expect(await verifyPassword(password, user!.passwordHash)).toBe(true);
      expect(await verifyPassword("wrong-password", user!.passwordHash)).toBe(false);
    }
    await rm(dir, { recursive: true, force: true });
  });
});

describe("rbac portal APIs are structurally self-scoped (IDOR guard-rail)", () => {
  const routes = [
    "app/api/partner/me/route.ts",
    "app/api/customer/me/route.ts",
    "app/api/affiliate/me/route.ts",
  ];
  for (const route of routes) {
    it(`${route} derives identity from the session only`, () => {
      const src = readFileSync(route, "utf8");
      expect(src).toContain("getCurrentUser");
      expect(src).not.toMatch(/nextUrl\.searchParams/);
      expect(src).not.toMatch(/body\.(organizationId|affiliateId|partnerId|userId)/);
      expect(src).not.toMatch(/params\.id/);
    });
  }
});
