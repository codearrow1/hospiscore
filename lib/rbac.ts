/**
 * Canonical application role hierarchy (RBAC merge).
 *
 * Merges the legacy Marketing Admin system and the SaaS control plane under a
 * single top-level hierarchy:
 *
 *   SUPER_ADMIN  — platform owner; full SaaS control
 *   SUBADMIN     — former Marketing Admin tier; marketing/operations scope
 *   STAFF        — internal operational staff (support/customer success)
 *   AFFILIATE    — portal identity (Affiliate row), own data only
 *   PARTNER      — portal identity (Partner row), own data only
 *   CUSTOMER     — portal identity (primary OrgContact), own org data only
 *
 * The granular capability/permission systems (`lib/marketing/roles.ts`,
 * `lib/saas/roles.ts`) remain the authorization engines; this module provides
 * the authoritative mapping used for dashboards, navigation and routing.
 */

import { CONFIG } from "@/lib/config";
import type { AuthUser } from "@/lib/auth";
import { roleFor } from "@/lib/marketing/roles";
import { SAAS_ROLES } from "@/lib/saas/roles";

export type AppRole =
  | "super_admin"
  | "subadmin"
  | "staff"
  | "affiliate"
  | "partner"
  | "customer";

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  subadmin: "Subadmin",
  staff: "Staff",
  affiliate: "Affiliate",
  partner: "Partner",
  customer: "Customer",
};

export const APP_ROLE_DASHBOARDS: Record<AppRole, string> = {
  super_admin: "/saas",
  subadmin: "/subadmin",
  staff: "/staff",
  affiliate: "/affiliate",
  partner: "/partner",
  customer: "/customer",
};

/** SaaS owner-side roles that route to the Super Admin dashboard. */
const SUPER_ADMIN_TIER = new Set<string>([
  "super_admin",
  "platform_admin",
  "finance_admin",
  "sales_admin",
  "affiliate_manager",
  "partner_manager",
  "franchise_manager",
]);

/** Internal operational roles. */
const STAFF_TIER = new Set<string>(["support_admin", "customer_success"]);

/**
 * Pure mapping from a stored user identity to its canonical role.
 * Portal identities (affiliate/partner/customer) require DB lookups and are
 * resolved by `resolveAppRole`; this function never touches the database.
 */
export function appRoleFromStoredRole(
  user: Pick<AuthUser, "email" | "role">,
): AppRole | null {
  const stored = (user.role ?? "").toLowerCase();
  if (SUPER_ADMIN_TIER.has(stored)) return "super_admin";
  if (STAFF_TIER.has(stored)) return "staff";
  // Legacy ADMIN_EMAILS allowlist remains a super-admin fallback.
  if (CONFIG.adminEmails.map((e) => e.toLowerCase()).includes(user.email.toLowerCase())) {
    return "super_admin";
  }
  // Any remaining recognized marketing/SaaS role is the Subadmin tier
  // (marketing admin variants, analyst, read_only, etc.).
  if (roleFor(user)) return "subadmin";
  if ((SAAS_ROLES as readonly string[]).includes(stored)) return "subadmin";
  return null;
}

/**
 * Full resolver: admins first, then portal identities from the SaaS plane.
 * Portal identity requires an explicit binding (Affiliate/Partner userId
 * column or a KV binding record) — never a raw email match (S-01).
 */
export async function resolveAppRole(
  user: Pick<AuthUser, "id" | "email" | "role">,
): Promise<AppRole | null> {
  const fromRole = appRoleFromStoredRole(user);
  if (fromRole === "super_admin" || fromRole === "staff") return fromRole;

  // Lazy import keeps this module importable from edge-safe contexts.
  const { initSaasDb } = await import("@/lib/saas/init");
  await initSaasDb().catch(() => {});

  const portalLinks = await import("@/lib/saas/portalLinks");
  const [affiliate, partner, contact] = await Promise.all([
    portalLinks.findAffiliateForUser(user.id).catch(() => null),
    portalLinks.findPartnerForUser(user.id).catch(() => null),
    portalLinks.findOrgContactForUser(user.id).catch(() => null),
  ]);

  if (affiliate) return "affiliate";
  if (partner) return "partner";
  if (contact) return "customer";
  return fromRole;
}

/** Dashboard route for a canonical role; signed-in users without one go to /account. */
export function dashboardPathFor(role: AppRole | null): string {
  return role ? APP_ROLE_DASHBOARDS[role] : "/account";
}
