import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { hasSaasPerm, getRolePermissions, SAAS_ROLES, type SaasPermission } from "@/lib/saas/roles";
import { SettingsLayout, SettingsSection } from "@/components/settings/SettingsUI";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAAS_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  platform_admin: "Platform Admin",
  finance_admin: "Finance Admin",
  marketing_admin: "Marketing Admin",
  sales_admin: "Sales Admin",
  customer_success: "Customer Success",
  support_admin: "Support Admin",
  affiliate_manager: "Affiliate Manager",
  partner_manager: "Partner Manager",
  franchise_manager: "Franchise Manager",
  analyst: "Analyst",
  read_only: "Read Only",
};

const PERMISSION_LABELS: Record<SaasPermission, string> = {
  CUSTOMER_VIEW: "View Customers",
  CUSTOMER_MANAGE: "Manage Customers",
  PROPERTY_VIEW: "View Properties",
  PROPERTY_MANAGE: "Manage Properties",
  PLAN_VIEW: "View Plans",
  PLAN_MANAGE: "Manage Plans",
  SUBSCRIPTION_VIEW: "View Subscriptions",
  SUBSCRIPTION_MANAGE: "Manage Subscriptions",
  BILLING_VIEW: "View Billing",
  BILLING_MANAGE: "Manage Billing",
  REFUND_APPROVE: "Approve Refunds",
  USAGE_VIEW: "View Usage",
  MARKETING_VIEW: "View Marketing",
  MARKETING_MANAGE: "Manage Marketing",
  AFFILIATE_VIEW: "View Affiliates",
  AFFILIATE_MANAGE: "Manage Affiliates",
  AFFILIATE_APPROVE: "Approve Affiliates",
  AFFILIATE_PAYOUT: "Manage Affiliate Payouts",
  PARTNER_VIEW: "View Partners",
  PARTNER_MANAGE: "Manage Partners",
  FRANCHISE_VIEW: "View Franchises",
  FRANCHISE_MANAGE: "Manage Franchises",
  FRANCHISE_FINANCE: "Franchise Finance",
  FINANCIAL_APPROVE: "Approve Financial Actions",
  FEATURE_FLAG_MANAGE: "Manage Feature Flags",
  SUPPORT_VIEW: "View Support",
  SUPPORT_MANAGE: "Manage Support",
  AUDIT_VIEW: "View Audit Log",
  SYSTEM_SETTINGS_MANAGE: "Manage System Settings",
};

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view roles.</p>
      </div>
    );
  }

  // Primary roles only (exclude legacy marketing duplicates)
  const primaryRoles = SAAS_ROLES.filter((r) =>
    ["super_admin", "platform_admin", "finance_admin", "marketing_admin", "sales_admin", "customer_success", "support_admin", "affiliate_manager", "partner_manager", "franchise_manager", "analyst", "read_only"].includes(r)
  );

  // Build role→permissions map
  const rolePerms: Record<string, SaasPermission[]> = {};
  for (const role of primaryRoles) {
    rolePerms[role] = getRolePermissions(role);
  }

  return (
    <SettingsLayout
      title="Roles & Permissions"
      description="Reference guide for all platform roles and their permissions."
    >
      <SettingsSection
        title="Role Hierarchy"
        description="Roles are listed from most to least privileged. Each role inherits only its explicitly assigned permissions."
      >
        <div className="space-y-4">
          {primaryRoles.map((role, idx) => (
            <div key={role} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                  {idx + 1}
                </span>
                <div>
                  <span className="text-sm font-semibold">{SAAS_ROLE_LABELS[role] || role}</span>
                  <span className="ml-2 text-xs text-zinc-400">{role}</span>
                </div>
                <span className="ml-auto text-xs text-zinc-400">
                  {rolePerms[role].length} permission{rolePerms[role].length !== 1 ? "s" : ""}
                </span>
              </div>
              {rolePerms[role].length > 0 && (
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {rolePerms[role].map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {PERMISSION_LABELS[perm]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="All Permissions"
        description="Complete list of 28 granular permissions available in the platform."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(PERMISSION_LABELS) as [SaasPermission, string][]).map(([perm, label]) => (
            <div
              key={perm}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium">{label}</span>
              <span className="ml-auto text-xs text-zinc-400 font-mono">{perm}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
