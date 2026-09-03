import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listTerritories, listFranchisees } from "@/lib/saas/franchise";
import { prisma } from "@/lib/prisma";
import FranchiseManager from "@/components/saas/FranchiseManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MRR per territory grouped by RECORD CURRENCY — never converted or merged.
 *  Feeds the client-side revenue-share simulator honestly (mixed-currency
 *  territories show their dominant currency plus a count of others). */
async function territoryMrrMap(): Promise<Record<string, Record<string, number>>> {
  const [orgs, subs] = await Promise.all([
    prisma.organization.findMany({ where: { franchiseTerritoryId: { not: null } }, select: { id: true, franchiseTerritoryId: true } }),
    prisma.subscription.groupBy({
      by: ["organizationId", "currency"],
      where: { status: { in: ["active", "trial", "past_due", "grace"] } },
      _sum: { mrr: true },
    }),
  ]);
  const mrrByOrg = new Map<string, Map<string, number>>();
  for (const s of subs) {
    const cur = s.currency || "USD";
    const inner = mrrByOrg.get(s.organizationId) ?? new Map<string, number>();
    inner.set(cur, (inner.get(cur) ?? 0) + (s._sum.mrr ?? 0));
    mrrByOrg.set(s.organizationId, inner);
  }
  const out: Record<string, Record<string, number>> = {};
  for (const o of orgs) {
    if (!o.franchiseTerritoryId) continue;
    const inner = mrrByOrg.get(o.id);
    if (!inner) continue;
    const bucket = out[o.franchiseTerritoryId] ?? {};
    for (const [cur, cents] of inner) bucket[cur] = (bucket[cur] ?? 0) + cents;
    out[o.franchiseTerritoryId] = bucket;
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
