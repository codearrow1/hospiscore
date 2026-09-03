import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrgTeamPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Organization Team", "Platform access required.");
  if (!hasSaasPerm(guard.user, "CUSTOMER_VIEW")) {
    return restrictedPanel("Organization Team", "Platform access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Organization Team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage team members and roles for your organization.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Team Members</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Manage team members and their roles within your organization.
        </p>
        <div className="mt-4">
          <a
            href="/saas/team"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:hover:border-indigo-700"
          >
            Go to Team Management →
          </a>
        </div>
      </section>
    </div>
  );
}
