import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listTerritories, listFranchisees } from "@/lib/saas/franchise";
import { prisma } from "@/lib/prisma";
import FranchiseManager from "@/components/saas/FranchiseManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MRR per territory feeds the client-side revenue-share simulator. */
async function territoryMrrMap(): Promise<Record<string, number>> {
  const [orgs, subs] = await Promise.all([
    prisma.organization.findMany({ where: { franchiseTerritoryId: { not: null } }, select: { id: true, franchiseTerritoryId: true } }),
    prisma.subscription.groupBy({
      by: ["organizationId"],
      where: { status: { in: ["active", "trial", "past_due", "grace"] } },
      _sum: { mrr: true },
    }),
  ]);
  const mrrByOrg = new Map(subs.map((s) => [s.organizationId, s._sum.mrr ?? 0]));
  const out: Record<string, number> = {};
  for (const o of orgs) {
    if (!o.franchiseTerritoryId) continue;
    out[o.franchiseTerritoryId] = (out[o.franchiseTerritoryId] ?? 0) + (mrrByOrg.get(o.id) ?? 0);
  }
  return out;
}

export default async function FranchisePage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Franchise", "Platform access required.");
  if (!hasSaasPerm(guard.user, "FRANCHISE_VIEW")) return restrictedPanel("Franchise", "FRANCHISE_VIEW required.");
  const [{ items: territories }, { items: franchisees }, tMrr] = await Promise.all([
    listTerritories({}),
    listFranchisees(),
    territoryMrrMap(),
  ]);
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
        territoryMrr={tMrr}
      />
    </div>
  );
}
