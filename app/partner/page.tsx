import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import { resolveAppRole } from "@/lib/rbac";
import { findPartnerForUser } from "@/lib/saas/portalLinks";
import OnboardingChecklist from "@/components/saas/OnboardingChecklist";
import { initSaasDb } from "@/lib/saas/init";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Partner portal — own portfolio, MRR influence, commissions, payouts. */
export default async function PartnerPortal() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/partner");
  await initSaasDb().catch(() => {});

  let partner = await findPartnerForUser(user.id).catch(() => null);
  if (!partner) {
    partner = await prisma.partner.findFirst({ where: { email: user.email } });
  }
  if (!partner) {
    const appRole = await resolveAppRole(user);
    if (appRole !== "super_admin") redirect("/account?next=/partner");
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <h1 className="text-2xl font-bold">Partner Portal</h1>
        <p className="mt-2 text-sm text-zinc-600">
          No partner account found for {user.email}. If an admin issued you a claim token, register with it at{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">/account?claim=YOUR-TOKEN</code>.
        </p>
      </div>
    );
  }

  const [commissions, payouts, referredOrgs] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.affiliatePayout.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.organization.findMany({
      where: { partnerId: partner.id },
      select: { id: true, businessName: true, legalName: true, country: true, mrr: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const earned = commissions.filter((c) => c.status !== "reversed").reduce((s, c) => s + c.amount, 0);
  const paid = payouts.reduce((s, p) => s + p.amount, 0);
  const referralLink = `${process.env.SITE_URL || "https://thebuddharice.online"}/?ref=${partner.referralCode}`;
  const pendingBalance = Math.max(earned - paid, 0);
  const mrrInfluence = referredOrgs.reduce((s, o) => s + o.mrr, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partner Portal</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {partner.name}
            {partner.company ? ` · ${partner.company}` : ""} · tier {partner.tier} · {partner.type.replace(/_/g, " ")}
          </p>
        </div>
        <StatusBadge domain="partner" status={partner.status} />
      </div>

      {pendingBalance > 0 && (
        <div className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          {formatMoney(pendingBalance, "USD")} earned but not yet paid out — clears on the next payout run.
        </div>
      )}

      <OnboardingChecklist title="Getting started" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SectionCard>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Referred accounts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{referredOrgs.length}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Portfolio MRR</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(mrrInfluence, "USD")}</p>
          <p className="text-xs text-zinc-500">combined referred-account MRR</p>
        </SectionCard>
        <SectionCard>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Lifetime earned</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(earned, "USD")}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Commission</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {partner.commissionModel === "fixed" ? formatMoney(partner.commissionValue, "USD") : `${(partner.commissionValue / 100).toFixed(1)}%`}
          </p>
          <p className="text-xs text-zinc-500">{partner.commissionModel.replace(/_/g, " ")}</p>
        </SectionCard>
      </div>

      <SectionCard title="Referral link">
        <code className="block break-all rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">{referralLink}</code>
      </SectionCard>

      <SectionCard title="Referred accounts (your portfolio)">
        <div id="referrals" />
        {referredOrgs.length === 0 ? (
          <EmptyState title="No referrals yet." body="Share your referral link to get started." />
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {referredOrgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2">
                <span className="font-medium">{o.businessName || o.legalName}</span>
                <span className="flex items-center gap-2 text-zinc-500">
                  {o.country || "—"} · MRR {formatMoney(o.mrr, "USD")}
                  <StatusBadge domain="organization" status={o.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] italic leading-relaxed text-zinc-400 dark:border-zinc-800">
          Implementation context: commissions are booked automatically when a referred organization&apos;s subscription activates — one commission per organization. Team management and a co-selling pipeline are not modeled yet.
        </p>
      </SectionCard>

      <SectionCard title="Recent commissions">
        <div id="commissions" />
        {commissions.length === 0 ? (
          <EmptyState title="No commissions yet." />
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {commissions.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-zinc-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{formatMoney(c.amount, c.currency)}</span>
                  <StatusBadge domain="commission" status={c.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Payout history">
        <div id="payouts" />
        {payouts.length === 0 ? (
          <EmptyState title="No payouts yet." />
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="text-zinc-600">{new Date(p.createdAt).toLocaleDateString()} · {p.method}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                  <StatusBadge domain="payout" status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
