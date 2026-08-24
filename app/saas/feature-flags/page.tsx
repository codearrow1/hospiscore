import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listOrganizations } from "@/lib/saas/organizations";
import { listPlans } from "@/lib/saas/plans";
import FeatureFlagsManager from "@/components/saas/FeatureFlagsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FeatureFlagsPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Feature Flags", "Platform access required.");
  const canManage = hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE");

  const [{ items: orgs }, plans] = await Promise.all([
    listOrganizations({ take: 100 }),
    listPlans({ includeArchived: false }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Runtime overrides for plan entitlements. Evaluation order: property → organization → plan → country → global → plan features.
          Percentage rollout buckets on hash(orgId + key). Toggling a flag mutates server state immediately and is audited.
        </p>
      </div>
      <FeatureFlagsManager
        plans={plans.map((p) => ({ id: p.id, label: p.name }))}
        orgs={orgs.map((o) => ({ id: o.id, label: o.legalName }))}
      />
      {!canManage && (
        <p className="text-xs text-zinc-400">View-only — SYSTEM_SETTINGS_MANAGE is required to create, toggle, or delete flags.</p>
      )}
    </div>
  );
}
