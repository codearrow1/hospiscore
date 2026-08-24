import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPartners } from "@/lib/saas/partners";
import { availablePayoutBalance } from "@/lib/saas/payouts";
import { prisma } from "@/lib/prisma";
import ReferralPartnerManager from "@/components/saas/ReferralPartnerManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Partner/reseller program admin — shared referral foundation, partner variant. */
export default async function PartnersPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Partners", "Platform access required.");
  if (!hasSaasPerm(guard.user, "PARTNER_VIEW")) return restrictedPanel("Partners", "PARTNER_VIEW required.");

  const [{ items: partners }, commissions, payouts, portfolioOrgs] = await Promise.all([
    listPartners({}),
    prisma.affiliateCommission.findMany({
      where: { partnerId: { not: null } },
      include: { organization: { select: { legalName: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.affiliatePayout.findMany({
      where: { partnerId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.organization.findMany({
      where: { partnerId: { not: null } },
      select: { id: true, legalName: true, businessName: true, mrr: true, country: true, status: true, partnerId: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const balances = await Promise.all(partners.map((p) => availablePayoutBalance({ partnerId: p.id }).catch(() => 0)));
  const balanceMap = Object.fromEntries(partners.map((p, i) => [p.id, balances[i] ?? 0]));

  const portfolioByPerson: Record<string, { id: string; name: string; mrr: number; country?: string | null; status: string }[]> = {};
  for (const o of portfolioOrgs) {
    if (!o.partnerId) continue;
    (portfolioByPerson[o.partnerId] ??= []).push({
      id: o.id,
      name: o.businessName || o.legalName,
      mrr: o.mrr,
      country: o.country,
      status: o.status,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Partners &amp; Resellers</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Active sellers and implementers — partners own referred accounts end-to-end. Same commission ledger and payout rails as affiliates.
        </p>
      </div>
      <ReferralPartnerManager
        variant="partner"
        people={partners.map((p) => ({
          id: p.id, name: p.name, email: p.email, company: p.company,
          country: p.country, website: p.website, type: p.type, tier: p.tier,
          status: p.status, referralCode: p.referralCode,
          commissionModel: p.commissionModel, commissionValue: p.commissionValue,
        }))}
        commissions={commissions.map((c) => ({
          id: c.id, ownerRef: c.partnerId ?? "", amount: c.amount, currency: c.currency,
          status: c.status, model: c.model, organizationName: c.organization?.legalName ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
        payouts={payouts.map((p) => ({
          id: p.id, ownerRef: p.partnerId ?? "", amount: p.amount, currency: p.currency,
          status: p.status, method: p.method, createdAt: p.createdAt.toISOString(),
        }))}
        canManage={hasSaasPerm(guard.user, "PARTNER_MANAGE")}
        canApprove={hasSaasPerm(guard.user, "PARTNER_MANAGE")}
        canPayout={hasSaasPerm(guard.user, "AFFILIATE_PAYOUT")}
        balances={balanceMap}
        portfolioByPerson={portfolioByPerson}
      />
    </div>
  );
}
