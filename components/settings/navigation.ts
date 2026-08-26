/**
 * Settings Navigation — Phase B
 *
 * Defines the settings navigation structure for all user roles.
 */
export interface SettingsNavItem {
  href: string;
  label: string;
  description?: string;
  icon?: string;
  permission?: string;
  category?: "account" | "platform" | "organization";
}

export const ACCOUNT_SETTINGS_NAV: SettingsNavItem[] = [
  {
    href: "/account/profile",
    label: "Profile",
    description: "Your name, avatar, and personal information",
    icon: "user",
    category: "account",
  },
  {
    href: "/account/security",
    label: "Security",
    description: "Password, two-factor authentication, and sessions",
    icon: "shield",
    category: "account",
  },
  {
    href: "/account/notifications",
    label: "Notifications",
    description: "How you receive notifications",
    icon: "bell",
    category: "account",
  },
  {
    href: "/account/preferences",
    label: "Preferences",
    description: "Language, timezone, and appearance",
    icon: "cog",
    category: "account",
  },
];

export const PLATFORM_SETTINGS_NAV: SettingsNavItem[] = [
  {
    href: "/saas/settings",
    label: "General",
    description: "Platform-wide settings",
    icon: "globe",
    permission: "SYSTEM_SETTINGS_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/settings/billing",
    label: "Billing",
    description: "Dunning, trials, and invoice settings",
    icon: "credit-card",
    permission: "BILLING_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/settings/affiliate",
    label: "Affiliate Program",
    description: "Commission, fraud, and payout settings",
    icon: "users",
    permission: "AFFILIATE_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/settings/email",
    label: "Email",
    description: "SMTP and email delivery settings",
    icon: "mail",
    permission: "SYSTEM_SETTINGS_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/settings/integrations",
    label: "Integrations",
    description: "API keys and third-party services",
    icon: "plug",
    permission: "SYSTEM_SETTINGS_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/settings/security",
    label: "Security",
    description: "Rate limiting and session settings",
    icon: "shield",
    permission: "SYSTEM_SETTINGS_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/team",
    label: "Team",
    description: "Manage team members and roles",
    icon: "users",
    permission: "SYSTEM_SETTINGS_MANAGE",
    category: "platform",
  },
  {
    href: "/saas/audit",
    label: "Audit Log",
    description: "View all settings changes",
    icon: "clipboard-list",
    permission: "AUDIT_VIEW",
    category: "platform",
  },
];

export const ORGANIZATION_SETTINGS_NAV: SettingsNavItem[] = [
  {
    href: "/saas/organization",
    label: "General",
    description: "Organization name, country, and currency",
    icon: "building",
    category: "organization",
  },
  {
    href: "/saas/organization/billing",
    label: "Billing",
    description: "Billing contact and payment methods",
    icon: "credit-card",
    category: "organization",
  },
  {
    href: "/saas/organization/team",
    label: "Team",
    description: "Organization team members",
    icon: "users",
    category: "organization",
  },
];

/**
 * Get the appropriate settings navigation for a user's role.
 */
export function getSettingsNav(role: string): SettingsNavItem[] {
  const nav: SettingsNavItem[] = [...ACCOUNT_SETTINGS_NAV];

  // Add platform settings for admin roles
  if (["super_admin", "platform_admin", "finance_admin", "marketing_admin"].includes(role)) {
    nav.push(...PLATFORM_SETTINGS_NAV);
  }

  // Add organization settings for org members
  if (["customer", "super_admin", "platform_admin"].includes(role)) {
    nav.push(...ORGANIZATION_SETTINGS_NAV);
  }

  return nav;
}
