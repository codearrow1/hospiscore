import type { AppRole } from "@/lib/rbac";

export interface PortalNavItem {
  href: string;
  label: string;
}

/**
 * Role-scoped portal navigation. Items derive from the caller's canonical
 * role only — every link points at a route the role is authorized to use.
 */
export const PORTAL_NAV: Record<AppRole, PortalNavItem[]> = {
  super_admin: [
    { href: "/saas", label: "Dashboard" },
    { href: "/saas/organizations", label: "Tenants" },
    { href: "/saas/subscriptions", label: "Subscriptions" },
    { href: "/saas/billing", label: "Billing" },
    { href: "/saas/affiliates", label: "Affiliates" },
    { href: "/saas/partners", label: "Partners" },
    { href: "/saas/support", label: "Support" },
    { href: "/account", label: "Profile" },
  ],
  subadmin: [
    { href: "/marketing-admin", label: "Dashboard" },
    { href: "/marketing-admin/leads", label: "Leads" },
    { href: "/marketing-admin/campaigns", label: "Campaigns" },
    { href: "/marketing-admin/pipeline", label: "Pipeline" },
    { href: "/marketing-admin/analytics", label: "Analytics" },
    { href: "/account", label: "Profile" },
  ],
  staff: [
    { href: "/staff", label: "Queue" },
    { href: "/account", label: "Profile" },
  ],
  affiliate: [
    { href: "/affiliate", label: "Dashboard" },
    { href: "/affiliate#commissions", label: "Commissions" },
    { href: "/affiliate#payouts", label: "Payouts" },
    { href: "/account", label: "Profile" },
  ],
  partner: [
    { href: "/partner", label: "Dashboard" },
    { href: "/partner#referrals", label: "Referrals" },
    { href: "/partner#commissions", label: "Commissions" },
    { href: "/partner#payouts", label: "Payouts" },
    { href: "/account", label: "Profile" },
  ],
  customer: [
    { href: "/customer", label: "Dashboard" },
    { href: "/customer#subscription", label: "Subscription" },
    { href: "/customer#usage", label: "Usage" },
    { href: "/customer#billing", label: "Billing" },
    { href: "/account", label: "Profile" },
  ],
};

export function portalPlane(role: AppRole): { id: string; name: string } {
  switch (role) {
    case "super_admin":
      return { id: "saas", name: "HospiOS Control" };
    case "subadmin":
      return { id: "growth", name: "HospiOS Growth" };
    case "staff":
      return { id: "staff", name: "HospiOS Support Desk" };
    case "affiliate":
      return { id: "affiliate", name: "Affiliate Portal" };
    case "partner":
      return { id: "partner", name: "Partner Portal" };
    default:
      return { id: "customer", name: "Customer Portal" };
  }
}
