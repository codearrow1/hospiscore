/**
 * Marketing Admin roles and permission matrix (Phase 29).
 *
 * Access model (per team decision): a user may hold an optional marketing role
 * stored on `AuthUser.role`, and the existing `ADMIN_EMAILS` allowlist remains
 * a back-compat super-admin fallback. Capabilities below implement the layered
 * model from the spec:
 *
 *  - Content Editor → website/global content only
 *  - Sales Rep → assigned leads/demos only
 *  - Marketing Manager → campaigns/content/analytics
 *  - Pricing Manager → pricing administration
 *  - Sales Manager → leads pipeline + assignment + team follow-ups
 *  - Analysts → read-only reporting
 *  - Super Admin / Marketing Admin → everything
 */

import { CONFIG } from "@/lib/config";
import type { AuthUser } from "@/lib/auth";

export type MarketingRole =
  | "super_admin"
  | "marketing_admin"
  | "marketing_manager"
  | "sales_manager"
  | "sales_rep"
  | "content_editor"
  | "seo_manager"
  | "analyst";

export const MARKETING_ROLES: readonly MarketingRole[] = [
  "super_admin",
  "marketing_admin",
  "marketing_manager",
  "sales_manager",
  "sales_rep",
  "content_editor",
  "seo_manager",
  "analyst",
];

export const ROLE_LABELS: Record<MarketingRole, string> = {
  super_admin: "Super Admin",
  marketing_admin: "Marketing Admin",
  marketing_manager: "Marketing Manager",
  sales_manager: "Sales Manager",
  sales_rep: "Sales Rep",
  content_editor: "Content Editor",
  seo_manager: "SEO Manager",
  analyst: "Analyst",
};

/** Every named capability the admin can check. */
export type Capability =
  | "access" // enter the marketing admin at all
  | "leads.read" // view lead CRM + dashboard metrics
  | "leads.write" // create/update leads, move stages
  | "leads.manage" // assign to others, delete, convert
  | "demos.manage" // book/reschedule/cancel demos on any lead
  | "campaigns.manage" // create/edit/end campaigns
  | "forms.manage" // edit form configs
  | "content.manage" // global content / section overrides
  | "pricing.manage" // edit local prices (finance-authoritative)
  | "analytics.read" // reports/analytics
  | "settings.manage" // roles, automation toggles, webhooks
  | "audit.read";

/** Every capability name, for deriving a user's effective capability list. */
export const MARKETING_CAPABILITIES: readonly Capability[] = [
  "access",
  "leads.read",
  "leads.write",
  "leads.manage",
  "demos.manage",
  "campaigns.manage",
  "forms.manage",
  "content.manage",
  "pricing.manage",
  "analytics.read",
  "settings.manage",
  "audit.read",
];

export const ROLE_CAPABILITIES: Record<
  MarketingRole,
  ReadonlySet<Capability>
> = {
  super_admin: new Set([
    "access",
    "leads.read",
    "leads.write",
    "leads.manage",
    "demos.manage",
    "campaigns.manage",
    "forms.manage",
    "content.manage",
    "pricing.manage",
    "analytics.read",
    "settings.manage",
    "audit.read",
  ]),
  marketing_admin: new Set([
    "access",
    "leads.read",
    "leads.write",
    "leads.manage",
    "demos.manage",
    "campaigns.manage",
    "forms.manage",
    "content.manage",
    "pricing.manage",
    "analytics.read",
    "settings.manage",
    "audit.read",
  ]),
  marketing_manager: new Set([
    "access",
    "leads.read",
    "leads.write",
    "demos.manage",
    "campaigns.manage",
    "forms.manage",
    "content.manage",
    "analytics.read",
  ]),
  sales_manager: new Set([
    "access",
    "leads.read",
    "leads.write",
    "leads.manage",
    "demos.manage",
    "analytics.read",
  ]),
  sales_rep: new Set([
    "access",
    "leads.read",
    "leads.write",
    "demos.manage",
  ]),
  content_editor: new Set([
    "access",
    "content.manage",
    "analytics.read",
  ]),
  seo_manager: new Set([
    "access",
    "content.manage",
    "analytics.read",
  ]),
  analyst: new Set(["access", "leads.read", "analytics.read"]),
};

export function isMarketingRole(v: unknown): v is MarketingRole {
  return (
    typeof v === "string" &&
    (MARKETING_ROLES as readonly string[]).includes(v)
  );
}

/**
 * Resolve the marketing role for a user. Role on the user wins; otherwise the
 * legacy ADMIN_EMAILS allowlist grants super_admin (back-compat).
 */
export function roleFor(
  user: Pick<AuthUser, "email" | "role">,
  allowed: readonly string[] = CONFIG.adminEmails,
): MarketingRole | null {
  if (user.role && isMarketingRole(user.role)) return user.role;
  if (allowed.includes(user.email.toLowerCase())) return "super_admin";
  return null;
}

/** Whether a user may enter the marketing admin at all. */
export function canAccess(
  user: Pick<AuthUser, "email" | "role">,
): boolean {
  return roleFor(user) !== null;
}

/**
 * Whether a user holds a capability. Admins implied by role or allowlist.
 * `scopeUser` narrows assignment/data scoping; owners always pass.
 */
export function hasCapability(
  user: Pick<AuthUser, "email" | "role">,
  capability: Capability,
): boolean {
  const role = roleFor(user);
  if (!role) return false;
  return (ROLE_CAPABILITIES[role] as ReadonlySet<string>).has(capability);
}

/** True when the user handles a lead (assigned or owns the record context). */
export function isOwner(
  user: Pick<AuthUser, "email">,
  leadOwnerEmail?: string,
  scopeUser?: string,
): boolean {
  return scopeUser === user.email || leadOwnerEmail === user.email;
}

/** Marketing roles that may assign leads / manage the whole team. */
export function canAssign(user: Pick<AuthUser, "role" | "email">): boolean {
  return hasCapability(user, "leads.manage");
}

/**
 * Per-lead access check (H-09): leads.manage holders see everything;
 * everyone else is restricted to leads assigned to them. Case-insensitive
 * because owner emails are free-form user input.
 */
export function canAccessLead(
  user: Pick<AuthUser, "email" | "role">,
  lead: { ownerEmail?: string | null },
): boolean {
  if (hasCapability(user, "leads.manage")) return true;
  return !!lead.ownerEmail && lead.ownerEmail.toLowerCase() === user.email.toLowerCase();
}