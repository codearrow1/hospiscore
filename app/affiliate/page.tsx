import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { getAffiliateByEmail } from "@/lib/saas/affiliates";
import { availablePayoutBalance } from "@/lib/saas/payouts";
import { findAffiliateForUser } from "@/lib/saas/portalLinks";
import { prisma } from "@/lib/prisma";
import { SectionCard, Badge, EmptyState } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import PortalShareCard from "@/components/saas/PortalShareCard";
import { initSaasDb } from "@/lib/saas/init";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FAQ: [string, string][] = [
  ["When do I earn?", "When someone subscribes through your link. Your account's commission model (fixed or % of MRR) decides the amount."],
  ["When can I withdraw?", "Once commissions reach “payable” they count toward your available balance — request a payout and finance settles it by bank/UPI/PayPal."],
  ["Why did a commission disappear?", "Reversals: refunds, chargebacks, early cancellations or flagged fraud. Reversed commissions leave your balance."],
];

/** Affiliate portal — own link, funnel, earnings, commissions, payouts. */
export default async function AffiliatePortal() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/affiliate");
  await initSaasDb().catch(() => {});

  let aff = await findAffiliateForUser(user.id).catch(() => null);
  if (!aff) aff = await getAffiliateByEmail(user.email);
  if (!aff) {
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <h1 className="text-2xl font-bold">Affiliate Portal</h1>
        <p className="mt-2 text-sm text-zinc-600">No affiliate account found for {user.email}.</p>
        <p className="mt-2 text-sm text-zinc-600">
          If an admin issued you a claim token, register with it at <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">/account?claim=YOUR-TOKEN</code> to bind this identity to your login.
        </p>
      </div>
    );
  }

  const [commissions, payouts, clickCount, balance] = await Promise.all([
    prisma.affiliateCommission.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.affiliatePayout.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.affiliateClick.count({ where: { affiliateId: aff.id } }),
    availablePayoutBalance({ affiliateId: aff.id }).catch(() => 0),
  ]);

  const referralLink = `${process.env.SITE_URL || "https://thebuddharice.online"}/?ref=${aff.referralCode}`;
  const subscriptions = commissions.filter((c) => c.organizationId).length;
  const earned = commissions.filter((c) => c.amount > 0 && c.status !== "reversed" && c.status !== "rejected").reduce((s, c) => s + c.amount, 0);
  const paidOut = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  /** Monthly earnings for the mini chart (last 6 months, record currency USD). */
  const months: [string, number][] = (() => {
    const map = new Map<string, number>();
    for (const c of commissions) {
      if (!["eligible", "approved", "payable", "paid"].includes(c.status)) continue;
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + c.amount);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  })();
  const maxMonth = Math.max(1, ...months.map((m) => m[1]));
  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

  const stepper = [
    ["Clicks", String(clickCount)],
    ["Attribution", String(commissions.length)],
    ["Subscription", String(subscriptions)],
    ["Commission", formatMoney(earned, "USD")],
    ["Payable", formatMoney(balance, "USD")],
    ["Paid out", formatMoney(paidOut, "USD")],
  ] as const;

  const pendingCount = commissions.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Your referral link, funnel, earnings and payouts — isolated to your account.</p>
      </div>

      {aff.status !== "active" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Your account is {aff.status} — referrals only earn once your account is approved.
        </div>
      )}
      {pendingCount > 0 && (
        <div className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          {pendingCount} commission{pendingCount === 1 ? "" : "s"} pending payout — they clear on the next payout run.
        </div>
      )}

      <SectionCard title="Your referral link">
        <PortalShareCard link={referralLink} />
        <div className="mt-2 flex gap-2 text-xs">
          <StatusBadge domain="affiliate" status={aff.status} />
          <Badge>{aff.tier}</Badge>
          <Badge>{aff.commissionModel.replace(/_/g, " ")} · {aff.commissionModel === "fixed" ? formatMoney(aff.commissionValue, "USD") : `${(aff.commissionValue / 100).toFixed(1)}%`}</Badge>
        </div>
      </SectionCard>

      {/* Funnel stepper */}
      <SectionCard title="From click to payout">
        <ol className="-mx-1 flex snap-x overflow-x-auto pb-1">
          {stepper.map(([label, value], i) => (
            <li key={label} className="flex min-w-24 flex-1 snap-start items-center gap-1 px-1">
              <div className="flex flex-col items-center text-center">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${value !== "0" && value !== "$0.00" ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>{i + 1}</span>
                <span className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
                <span className="whitespace-nowrap text-xs font-bold tabular-nums">{value}</span>
              </div>
              {i < stepper.length - 1 && <span aria-hidden className="mb-4 h-px w-auto grow bg-zinc-300 dark:bg-zinc-600" />}
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Lifetime earned"><p className="text-2xl font-bold tabular-nums">{formatMoney(earned, "USD")}</p></SectionCard>
        <SectionCard title="Available balance">
          <p className="text-2xl font-bold tabular-nums">{formatMoney(balance, "USD")}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">Unpaid remainder of payable commissions minus open payout requests. Request via the program team.</p>
        </SectionCard>
        <SectionCard title="Earnings trend">
          {months.length === 0 ? (
            <p className="pt-4 text-xs text-zinc-400">No earnings in the last months yet.</p>
          ) : (
            <div className="flex h-20 items-end gap-1.5 pt-2">
              {months.map(([key, cents]) => (
                <div key={key} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(key)} · ${formatMoney(cents, "USD")}`}>
                  <div className="w-full rounded-t bg-indigo-500/80 dark:bg-indigo-400/70" style={{ height: `${Math.max(5, Math.round((cents / maxMonth) * 52))}px` }} />
                  <span className="text-[9px] text-zinc-400">{monthLabel(key)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Commissions">
        <div id="commissions" />
        {commissions.length === 0 ? <EmptyState title="No commissions yet" body="When your referrals subscribe, commissions appear here." /> : (
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-zinc-400"><th className="py-1">Date</th><th className="py-1 text-right">Amount</th><th className="py-1">Model</th><th className="py-1">State</th></tr></thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1 pr-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(c.amount, c.currency)}</td>
                  <td className="py-1 pr-2 text-xs">{c.model.replace(/_/g, " ")}</td>
                  <td className="py-1"><StatusBadge domain="commission" status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-zinc-400 hover:text-zinc-600">What each state means</summary>
          <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
            <li>pending — attributed, waiting for the referral&apos;s first payment</li>
            <li>eligible → approved — paid, clearing the review window</li>
            <li>payable — counts toward your balance</li>
            <li>paid — settled via a payout</li>
            <li>reversed / rejected / fraud_hold — refund, chargeback or flag</li>
          </ul>
        </details>
      </SectionCard>

      <SectionCard title="Payout history">
        <div id="payouts" />
        {payouts.length === 0 ? <EmptyState title="No payouts yet" body="Once your balance builds up, the program team settles it by bank/UPI/PayPal." /> : (
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-zinc-400"><th className="py-1">Date</th><th className="py-1 text-right">Amount</th><th className="py-1">Method</th><th className="py-1">State</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1 pr-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  <td className="py-1 pr-2 uppercase text-xs">{p.method}</td>
                  <td className="py-1"><StatusBadge domain="payout" status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Resources &amp; FAQ">
        <ul className="space-y-2.5">
          {FAQ.map(([q, a]) => (
            <li key={q} className="text-sm">
              <p className="font-semibold">{q}</p>
              <p className="text-xs text-zinc-500">{a}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
