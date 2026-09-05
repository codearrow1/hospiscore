import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listTerritories, listFranchisees } from "@/lib/saas/franchise";
import FranchiseManager from "@/components/saas/FranchiseManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FranchisePage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Franchise", "Platform access required.");
  if (!hasSaasPerm(guard.user, "FRANCHISE_VIEW")) return restrictedPanel("Franchise", "FRANCHISE_VIEW required.");
  const [{ items: territories }, { items: franchisees }] = await Promise.all([listTerritories({}), listFranchisees()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Franchise &amp; Territories</h1>
        <p className="mt-1 text-sm text-zinc-500">Commercial territory network (master → region → city). Exclusive territories cannot overlap; revenue share = bps of customer MRR per franchisee.</p>
      </div>
      <FranchiseManager
        initialTerritories={territories as never[]}
        initialFranchisees={franchisees as never[]}
        canManage={hasSaasPerm(guard.user, "FRANCHISE_MANAGE")}
      />
    </div>
  );
}
