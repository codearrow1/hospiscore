import { getCurrentUser } from "@/lib/sessionCookie";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasSaasPerm } from "@/lib/saas/roles";
import { SAAS_ROLES } from "@/lib/saas/roles";
import { MARKETING_ROLES, ROLE_LABELS as MARKETING_ROLE_LABELS } from "@/lib/marketing/roles";
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

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage team settings.</p>
      </div>
    );
  }

  // Read users from data file
  const { readData } = await import("@/lib/db");
  const data = await readData();

  return (
    <SettingsLayout
      title="Team Management"
      description="View and manage platform team members and their roles."
    >
      <SettingsSection
        title="Team Members"
        description="All registered platform users and their assigned roles."
      >
        {data.users.length === 0 ? (
          <p className="text-sm text-zinc-500">No users registered yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {u.role
                          ? SAAS_ROLE_LABELS[u.role] || MARKETING_ROLE_LABELS[u.role as keyof typeof MARKETING_ROLE_LABELS] || u.role
                          : "No role"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Available SaaS Roles"
        description="Platform roles that can be assigned to team members. Roles are assigned via the database or marketing admin."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SAAS_ROLES.map((role) => (
            <div
              key={role}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium">{SAAS_ROLE_LABELS[role] || role}</span>
              <span className="ml-auto text-xs text-zinc-400">{role}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400">
          Role assignment is managed via the marketing admin or direct database updates. UI for role management will be added in Phase D.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Marketing Roles"
        description="Roles from the marketing plane (can also access SaaS features based on RBAC mapping)."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_ROLES.map((role) => (
            <div
              key={role}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-sm font-medium">{MARKETING_ROLE_LABELS[role]}</span>
              <span className="ml-auto text-xs text-zinc-400">{role}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
