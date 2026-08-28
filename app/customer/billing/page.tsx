import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";
import { resolveOrgForUser } from "@/lib/saas/portalAccess";
import { formatMoney, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/Badge";
import PayNowButton from "@/components/customer/PayNowButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Customer billing — the customer self-serve payment surface. Lists the
 * organization's invoices with payable balances and a Pay Now control. Payment
 * amounts are always computed server-side from authoritative invoice/payment
 * rows (the browser never sends an amount).
 */
export default async function CustomerBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/customer/billing");
  await initSaasDb().catch(() => {});

  const resolved = await resolveOrgForUser(user);
  if (!resolved) redirect("/account?next=/customer");

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: resolved.organizationId },
    orderBy: { createdAt: "desc" },
    include: { payments: true },
  });

  const rows = invoices.map((i) => {
    const paid = i.payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount, 0);
    return {
      id: i.id,
      type: i.type,
      status: i.status,
      currency: i.currency,
      amount: i.amount,
      paid,
      due: Math.max(i.amount - paid, 0),
      dueAt: i.dueAt,
      createdAt: i.createdAt,
    };
  });

  const totalOutstanding = rows.reduce((s, r) => s + (r.status === "paid" ? 0 : r.due), 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="mt-1 text-sm text-zinc-500">Pay your invoices securely. Status is confirmed after verification.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-2 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Outstanding</p>
          <p className="text-xl font-bold tabular-nums">{formatMoney(totalOutstanding, rows[0]?.currency ?? "USD")}</p>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-zinc-500">
          You have no invoices.
        </div>
      )}

      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/customer/invoices/${r.id}`} className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                    Invoice {r.id.slice(-8).toUpperCase()}
                  </Link>
                  <StatusBadge domain="invoice" status={r.status} />
                </div>
                <p className="mt-1 text-xs capitalize text-zinc-500">
                  {r.type.replace(/_/g, " ")} · issued {formatDate(r.createdAt)}
                  {r.dueAt ? ` · due ${formatDate(r.dueAt)}` : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold tabular-nums">{formatMoney(r.due, r.currency)}</p>
                <p className="text-xs text-zinc-500">of {formatMoney(r.amount, r.currency)}</p>
              </div>
            </div>
            {r.due > 0 && r.status !== "paid" ? (
              <div className="mt-4">
                <PayNowButton invoiceId={r.id} amountMinor={r.due} currency={r.currency} />
              </div>
            ) : (
              <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">Paid in full.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
