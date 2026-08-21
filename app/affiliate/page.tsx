import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { getAffiliateByEmail } from "@/lib/saas/affiliates";
import { prisma } from "@/lib/prisma";
import Header from "@/components/Header";
import { SectionCard, Badge, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AffiliatePortal() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/affiliate");
  let aff = await getAffiliateByEmail(user.email);
  if (!aff) {
    const byUser = await prisma.affiliate.findFirst({ where: { userId: user.id } });
    aff = byUser;
  }
  if (!aff) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <h1 className="text-2xl font-bold">Affiliate Portal</h1>
          <p className="mt-2 text-sm text-zinc-600">No affiliate account found for {user.email}. Apply via the SaaS team or contact support.</p>
        </main>
      </div>
    );
  }
  const [commissions, payouts, clicks] = await Promise.all([
    prisma.affiliateCommission.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.affiliatePayout.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.affiliateClick.count({ where: { affiliateId: aff.id } }),
  ]);
  const referralLink = `${process.env.SITE_URL || "https://thebuddharice.online"}/?ref=${aff.referralCode}`;
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Your referral link, clicks, conversions, commissions — isolated to your account.</p>
        </div>
        <SectionCard title="Your Referral Link">
          <p className="font-mono text-sm bg-zinc-50 p-2 rounded dark:bg-zinc-800">{referralLink}</p>
          <p className="mt-1 text-xs text-zinc-500">Share this link. Clicks → Leads → Trials → Subscriptions → Commission.</p>
          <div className="mt-2 flex gap-2 text-xs">
            <Badge>{aff.status}</Badge>
            <Badge>{aff.tier}</Badge>
            <Badge>{aff.commissionModel} {aff.commissionValue}</Badge>
          </div>
        </SectionCard>
        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard title="Clicks"><p className="text-2xl font-bold">{clicks}</p></SectionCard>
          <SectionCard title="Commissions"><p className="text-2xl font-bold">{commissions.length}</p><p className="text-xs text-zinc-500">Pending: {commissions.filter(c=>c.status==="pending").length} · Paid: {commissions.filter(c=>c.status==="paid").length}</p></SectionCard>
          <SectionCard title="Payouts"><p className="text-2xl font-bold">{payouts.length}</p><p className="text-xs text-zinc-500">Paid: {(payouts.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0)/100).toFixed(2)}</p></SectionCard>
        </div>
        <SectionCard title="Recent Commissions">
          {commissions.length===0 ? <EmptyState title="No commissions yet" body="When your referrals subscribe, commissions appear here." /> : (
            <table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-zinc-400"><th>Amount</th><th>Status</th><th>Model</th><th>Date</th></tr></thead><tbody>{commissions.map(c=><tr key={c.id} className="border-t"><td className="py-1">${(c.amount/100).toFixed(2)}</td><td className="py-1"><Badge>{c.status}</Badge></td><td className="py-1 text-xs">{c.model}</td><td className="py-1 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
          )}
        </SectionCard>
        <SectionCard title="Payouts">
          {payouts.length===0 ? <EmptyState title="No payouts yet" /> : (
            <table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-zinc-400"><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>{payouts.map(p=><tr key={p.id} className="border-t"><td className="py-1">${(p.amount/100).toFixed(2)}</td><td className="py-1">{p.method}</td><td className="py-1"><Badge>{p.status}</Badge></td><td className="py-1 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
