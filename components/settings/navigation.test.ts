import { describe, it, expect } from "vitest";
import {
  getSettingsNav,
  PLATFORM_SETTINGS_NAV,
  ORGANIZATION_SETTINGS_NAV,
  ACCOUNT_SETTINGS_NAV,
} from "./navigation";

describe("Settings Navigation", () => {
  it("ACCOUNT_SETTINGS_NAV has 4 items", () => {
    expect(ACCOUNT_SETTINGS_NAV).toHaveLength(4);
  });

  it("PLATFORM_SETTINGS_NAV includes all platform sub-pages", () => {
    const hrefs = PLATFORM_SETTINGS_NAV.map((n) => n.href);
    expect(hrefs).toContain("/saas/settings");
    expect(hrefs).toContain("/saas/settings/billing");
    expect(hrefs).toContain("/saas/settings/affiliate");
    expect(hrefs).toContain("/saas/settings/email");
    expect(hrefs).toContain("/saas/settings/integrations");
    expect(hrefs).toContain("/saas/settings/security");
    expect(hrefs).toContain("/saas/team");
    expect(hrefs).toContain("/saas/roles");
    expect(hrefs).toContain("/saas/affiliates");
    expect(hrefs).toContain("/saas/partners");
    expect(hrefs).toContain("/saas/franchise");
    expect(hrefs).toContain("/saas/audit");
  });

  it("ORGANIZATION_SETTINGS_NAV includes org sub-pages", () => {
    const hrefs = ORGANIZATION_SETTINGS_NAV.map((n) => n.href);
    expect(hrefs).toContain("/saas/organization");
    expect(hrefs).toContain("/saas/organizations");
    expect(hrefs).toContain("/saas/properties");
    expect(hrefs).toContain("/saas/organization/billing");
    expect(hrefs).toContain("/saas/organization/team");
  });

  it("getSettingsNav returns account + platform for super_admin", () => {
    const nav = getSettingsNav("super_admin");
    const hrefs = nav.map((n) => n.href);
    expect(hrefs).toContain("/account/profile");
    expect(hrefs).toContain("/saas/settings");
    expect(hrefs).toContain("/saas/settings/email");
    expect(hrefs).toContain("/saas/settings/integrations");
    expect(hrefs).toContain("/saas/organization");
  });

  it("getSettingsNav returns only account for customer", () => {
    const nav = getSettingsNav("customer");
    const hrefs = nav.map((n) => n.href);
    expect(hrefs).toContain("/account/profile");
    expect(hrefs).toContain("/saas/organization");
    expect(hrefs).not.toContain("/saas/settings");
  });

  it("getSettingsNav returns account only for analyst", () => {
    const nav = getSettingsNav("analyst");
    expect(nav).toHaveLength(ACCOUNT_SETTINGS_NAV.length);
  });

  it("every nav item has required fields", () => {
    const allNav = [...ACCOUNT_SETTINGS_NAV, ...PLATFORM_SETTINGS_NAV, ...ORGANIZATION_SETTINGS_NAV];
    for (const item of allNav) {
      expect(item.href).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.category).toBeTruthy();
    }
  });
});
