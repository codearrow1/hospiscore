import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listAffiliates } from "@/lib/saas/affiliates";
import { listCommissions } from "@/lib/saas/commissions";
import { listPayouts } from "@/lib/saas/payouts";
import { availablePayoutBalance } from "@/lib/saas/payouts";
import { prisma } from "@/lib/prisma";
import ReferralPartnerManager from "@/components/saas/ReferralPartnerManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Affiliate program admin — shared referral foundation, affiliate variant. */
export default async function AffiliatesPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Affiliates", "Platform access required.");
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return restrictedPanel("Affiliates", "AFFILIATE_VIEW required.");

  const [{ items: affiliates }, { items: commissions }, { items: payouts }] = await Promise.all([
    listAffiliates({}),
    listCommissions({}),
    listPayouts({}),
  ]);

  const [clickGroups, balances] = await Promise.all([
    prisma.affiliateClick.groupBy({ by: ["affiliateId"], _count: { _all: true } }).catch(() => []),
    Promise.all(affiliates.map((a) => availablePayoutBalance({ affiliateId: a.id }).catch(() => 0))),
  ]);
  const clicksByPerson = Object.fromEntries(clickGroups.map((g) => [g.affiliateId, g._count._all]));
  const balanceMap = Object.fromEntries(affiliates.map((a, i) => [a.id, balances[i] ?? 0]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Affiliates</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Referral network — affiliates share links and earn on subscriptions. Funnel: click → attribution → subscription → commission → payout.
        </p>
      </div>
      <ReferralPartnerManager
        variant="affiliate"
        people={affiliates.map((a) => ({
          id: a.id, name: a.name, email: a.email, businessName: a.businessName,
          country: a.country, website: a.website, tier: a.tier ?? "standard",
          status: a.status, referralCode: a.referralCode,
          commissionModel: a.commissionModel, commissionValue: a.commissionValue,
        }))}
        commissions={commissions.map((c) => ({
          id: c.id, ownerRef: c.affiliateId ?? "", amount: c.amount, currency: c.currency,
          status: c.status, model: c.model, organizationName: c.organization?.legalName ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
        payouts={payouts.map((p) => ({
          id: p.id, ownerRef: p.affiliateId ?? "", amount: p.amount, currency: p.currency,
          status: p.status, method: p.method, createdAt: p.createdAt.toISOString(),
        }))}
        canManage={hasSaasPerm(guard.user, "AFFILIATE_MANAGE")}
        canApprove={hasSaasPerm(guard.user, "AFFILIATE_APPROVE")}
        canPayout={hasSaasPerm(guard.user, "AFFILIATE_PAYOUT")}
        clicksByPerson={clicksByPerson}
        balances={balanceMap}
      />
    </div>
  );
}
