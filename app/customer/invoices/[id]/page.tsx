import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";
import { resolveOrgForUser } from "@/lib/saas/portalAccess";
import { formatMoney, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/Badge";
import PrintButton from "@/components/saas/PrintButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Printable invoice view for the customer portal.
 * BACKEND GAP (labeled): server-side PDF generation is planned — this page is
 * print-optimized so customers can use the browser's Print → Save as PDF.
 */
export default async function CustomerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/account?next=/customer/invoices/${id}`);
  await initSaasDb().catch(() => {});

  const org = await resolveOrgForUser(user);
  if (!org) redirect("/account?next=/customer");

  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: org.organizationId },
    include: {
      organization: { select: { businessName: true, legalName: true, country: true } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) notFound();

  const paidCents = invoice.payments
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <div className="mb-4 flex items-center justify-between">
        <a href="/customer" className="text-sm text-indigo-600 hover:underline print:hidden dark:text-indigo-400">← Back to portal</a>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">HospiOS</p>
            <h1 className="mt-1 text-xl font-bold">Invoice {invoice.id.slice(-8).toUpperCase()}</h1>
            <p className="mt-1 text-xs text-zinc-500">Issued {formatDate(invoice.createdAt)}</p>
          </div>
          <div className="text-right text-sm">
            <StatusBadge domain="invoice" status={invoice.status} />
            <p className="mt-1 text-xs text-zinc-500">Due {invoice.dueAt ? formatDate(invoice.dueAt) : "—"}</p>
          </div>
        </header>

        <section className="grid gap-4 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Billed to</p>
            <p className="mt-1 text-sm font-medium">{invoice.organization.businessName || invoice.organization.legalName}</p>
            {invoice.organization.country && <p className="text-xs text-zinc-500">{invoice.organization.country}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Amount due</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(Math.max(invoice.amount - paidCents, 0), invoice.currency)}</p>
            <p className="text-xs text-zinc-500">of {formatMoney(invoice.amount, invoice.currency)} total</p>
          </div>
        </section>

        <table className="w-full border-t border-zinc-100 text-sm dark:border-zinc-800">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400">
              <th className="py-2 font-bold">Line item</th>
              <th className="py-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-50 dark:border-zinc-800/60">
              <td className="py-2 capitalize">{invoice.type.replace(/_/g, " ")}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</td>
            </tr>
            <tr>
              <td className="pt-3 font-semibold">Total</td>
              <td className="pt-3 text-right font-semibold tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>

        {invoice.payments.length > 0 && (
          <section className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Payments</p>
            <ul className="mt-1 space-y-1 text-xs">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{formatDate(p.createdAt)} · {p.gateway}</span>
                  <span>
                    <span className="tabular-nums">{formatMoney(p.amount, p.currency)}</span>{" "}
                    <span className={p.status === "succeeded" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>({p.status})</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-6 border-t border-zinc-100 pt-3 text-[11px] italic text-zinc-400 dark:border-zinc-800">
          Questions about this invoice? Open a billing ticket from your customer portal.
          Server-side PDF generation is planned — this view is optimized for browser printing.
        </footer>
      </article>
    </div>
  );
}
