import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listOrganizations } from "@/lib/saas/organizations";
import UsageDashboard from "@/components/saas/UsageDashboard";
import FeatureFlagsManager from "@/components/saas/FeatureFlagsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function UsagePage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Usage", "Platform access required.");
  const { items: orgs } = await listOrganizations({ take: 100 });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage & Entitlements</h1>
        <p className="mt-1 text-sm text-zinc-500">Per-organization usage vs plan limits, with server-side enforcement via <code>enforceLimit()</code> — centralized in <code>lib/saas/usage.ts</code> + <code>lib/saas/entitlements.ts</code>.</p>
      </div>
      {orgs.length === 0 ? (
        <p className="text-sm text-zinc-500">No organizations yet — create one first.</p>
      ) : (
        <UsageDashboard orgs={orgs.map((o) => ({ id: o.id, legalName: o.legalName }))} />
      )}
      <FeatureFlagsManager />
    </div>
  );
}
