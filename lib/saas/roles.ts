/**
 * SaaS Owner Platform RBAC — extends marketing hasCapability
 * Granular permissions: CUSTOMER_VIEW/MANAGE, PLAN_VIEW/MANAGE, SUBSCRIPTION_*, BILLING_*, etc.
 * Phase 22 target is 12 owner roles; Phase 1 thin slice maps existing marketing roles to SaaS perms.
 */

import { hasCapability as hasMarketingCapability, roleFor } from "@/lib/marketing/roles";
import type { AuthUser } from "@/lib/auth";

export type SaasPermission =
  | "CUSTOMER_VIEW"
  | "CUSTOMER_MANAGE"
  | "PROPERTY_VIEW"
  | "PROPERTY_MANAGE"
  | "PLAN_VIEW"
  | "PLAN_MANAGE"
  | "SUBSCRIPTION_VIEW"
  | "SUBSCRIPTION_MANAGE"
  | "BILLING_VIEW"
  | "BILLING_MANAGE"
  | "REFUND_APPROVE"
  | "USAGE_VIEW"
  | "MARKETING_VIEW"
  | "MARKETING_MANAGE"
  | "AFFILIATE_VIEW"
  | "AFFILIATE_MANAGE"
  | "AFFILIATE_APPROVE"
  | "AFFILIATE_PAYOUT"
  | "PARTNER_VIEW"
  | "PARTNER_MANAGE"
  | "FRANCHISE_VIEW"
  | "FRANCHISE_MANAGE"
  | "FRANCHISE_FINANCE"
  | "FINANCIAL_APPROVE"
  | "FEATURE_FLAG_MANAGE"
  | "SUPPORT_VIEW"
  | "SUPPORT_MANAGE"
  | "AUDIT_VIEW"
  | "SYSTEM_SETTINGS_MANAGE";

export const SAAS_ROLES = [
  "super_admin",
  "platform_admin",
  "finance_admin",
  "marketing_admin",
  "sales_admin",
  "customer_success",
  "support_admin",
  "affiliate_manager",
  "partner_manager",
  "franchise_manager",
  "analyst",
  "read_only",
  // legacy marketing roles kept for backward compat
  "marketing_manager",
  "sales_manager",
  "sales_rep",
  "content_editor",
  "seo_manager",
] as const;

export type SaasRole = (typeof SAAS_ROLES)[number];

const ROLE_SAAS_PERMS: Record<string, ReadonlySet<SaasPermission>> = {
  super_admin: new Set([
    "CUSTOMER_VIEW","CUSTOMER_MANAGE","PROPERTY_VIEW","PROPERTY_MANAGE","PLAN_VIEW","PLAN_MANAGE",
    "SUBSCRIPTION_VIEW","SUBSCRIPTION_MANAGE","BILLING_VIEW","BILLING_MANAGE","REFUND_APPROVE","USAGE_VIEW",
    "MARKETING_VIEW","MARKETING_MANAGE","AFFILIATE_VIEW","AFFILIATE_MANAGE","AFFILIATE_APPROVE","AFFILIATE_PAYOUT",
    "PARTNER_VIEW","PARTNER_MANAGE","FRANCHISE_VIEW","FRANCHISE_MANAGE","FRANCHISE_FINANCE","FINANCIAL_APPROVE",
    "FEATURE_FLAG_MANAGE","SUPPORT_VIEW","SUPPORT_MANAGE","AUDIT_VIEW","SYSTEM_SETTINGS_MANAGE",
  ]),
  platform_admin: new Set([
    "CUSTOMER_VIEW","CUSTOMER_MANAGE","PROPERTY_VIEW","PROPERTY_MANAGE","PLAN_VIEW","PLAN_MANAGE",
    "SUBSCRIPTION_VIEW","SUBSCRIPTION_MANAGE","BILLING_VIEW","BILLING_MANAGE","REFUND_APPROVE","USAGE_VIEW",
    "MARKETING_VIEW","MARKETING_MANAGE","AFFILIATE_VIEW","AFFILIATE_MANAGE","AFFILIATE_APPROVE","AFFILIATE_PAYOUT",
    "PARTNER_VIEW","PARTNER_MANAGE","FRANCHISE_VIEW","FRANCHISE_MANAGE","FRANCHISE_FINANCE","FINANCIAL_APPROVE",
    "FEATURE_FLAG_MANAGE","SUPPORT_VIEW","SUPPORT_MANAGE","AUDIT_VIEW","SYSTEM_SETTINGS_MANAGE",
  ]),
  finance_admin: new Set(["CUSTOMER_VIEW","PLAN_VIEW","SUBSCRIPTION_VIEW","BILLING_VIEW","BILLING_MANAGE","REFUND_APPROVE","AUDIT_VIEW","USAGE_VIEW"]),
  // Subadmin tier (RBAC merge): marketing/operations scope only — read-only
  // visibility into SaaS entities; all SaaS write controls are Super Admin.
  marketing_admin: new Set(["MARKETING_VIEW","MARKETING_MANAGE","CUSTOMER_VIEW","BILLING_VIEW","AUDIT_VIEW"]),
  sales_admin: new Set(["CUSTOMER_VIEW","PROPERTY_VIEW","SUBSCRIPTION_VIEW","USAGE_VIEW","AUDIT_VIEW"]),
  customer_success: new Set(["CUSTOMER_VIEW","CUSTOMER_MANAGE","PROPERTY_VIEW","SUBSCRIPTION_VIEW","USAGE_VIEW","BILLING_VIEW","SUPPORT_VIEW","SUPPORT_MANAGE","AUDIT_VIEW"]),
  support_admin: new Set(["CUSTOMER_VIEW","SUBSCRIPTION_VIEW","BILLING_VIEW","PROPERTY_VIEW","AUDIT_VIEW","USAGE_VIEW","SUPPORT_VIEW","SUPPORT_MANAGE"]),
  affiliate_manager: new Set(["AFFILIATE_VIEW","AFFILIATE_MANAGE","AFFILIATE_APPROVE","AFFILIATE_PAYOUT","CUSTOMER_VIEW","AUDIT_VIEW"]),
  partner_manager: new Set(["PARTNER_VIEW","PARTNER_MANAGE","CUSTOMER_VIEW","AUDIT_VIEW"]),
  franchise_manager: new Set(["FRANCHISE_VIEW","FRANCHISE_MANAGE","FRANCHISE_FINANCE","CUSTOMER_VIEW","AUDIT_VIEW"]),
  analyst: new Set(["CUSTOMER_VIEW","PROPERTY_VIEW","SUBSCRIPTION_VIEW","BILLING_VIEW","AUDIT_VIEW","USAGE_VIEW","MARKETING_VIEW","AFFILIATE_VIEW","PARTNER_VIEW","FRANCHISE_VIEW"]),
  read_only: new Set(["CUSTOMER_VIEW","PROPERTY_VIEW","PLAN_VIEW","SUBSCRIPTION_VIEW","BILLING_VIEW","USAGE_VIEW","MARKETING_VIEW","AFFILIATE_VIEW","PARTNER_VIEW","FRANCHISE_VIEW","SUPPORT_VIEW","AUDIT_VIEW"]),
  marketing_manager: new Set(["CUSTOMER_VIEW","PROPERTY_VIEW","PLAN_VIEW","SUBSCRIPTION_VIEW","BILLING_VIEW","MARKETING_VIEW"]),
  sales_manager: new Set(["CUSTOMER_VIEW","PROPERTY_VIEW","SUBSCRIPTION_VIEW","USAGE_VIEW"]),
  sales_rep: new Set(["CUSTOMER_VIEW","PROPERTY_VIEW","SUBSCRIPTION_VIEW"]),
  content_editor: new Set(["CUSTOMER_VIEW"]),
  seo_manager: new Set(["CUSTOMER_VIEW"]),
};

export function isSaasRole(v: unknown): v is SaasRole {
  return typeof v === "string" && (SAAS_ROLES as readonly string[]).includes(v);
}

export function saasRoleFor(user: Pick<AuthUser, "email" | "role">): SaasRole | null {
  if (user.role && isSaasRole(user.role)) return user.role as SaasRole;
  // fallback to marketing roleFor (handles ADMIN_EMAILS super_admin)
  const m = roleFor(user);
  if (m && isSaasRole(m)) return m as SaasRole;
  if (m) return m as unknown as SaasRole;
  return null;
}

export function hasSaasPerm(user: Pick<AuthUser, "email" | "role">, perm: SaasPermission): boolean {
  const role = saasRoleFor(user);
  if (!role) return false;
  const perms = ROLE_SAAS_PERMS[role];
  return perms ? (perms as ReadonlySet<string>).has(perm) : false;
}

export function requireSaasPerm(user: Pick<AuthUser, "email" | "role">, perm: SaasPermission): boolean {
  return hasSaasPerm(user, perm);
}

/** Return all permissions for a given role key. */
export function getRolePermissions(role: string): SaasPermission[] {
  const perms = ROLE_SAAS_PERMS[role];
  if (!perms) return [];
  return Array.from(perms) as SaasPermission[];
}

// Re-export marketing guard for incremental migration
export { hasMarketingCapability, roleFor };
