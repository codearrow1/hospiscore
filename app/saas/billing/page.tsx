import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listInvoices, listPayments, invoiceTotals } from "@/lib/saas/billing";
import { listOrganizations } from "@/lib/saas/organizations";
import BillingClient, { type InvoiceView, type PaymentView } from "@/components/saas/BillingClient";
import BillingManager from "@/components/saas/BillingManager";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 25;

const INVOICE_STATUSES = ["draft", "issued", "paid", "partially_paid", "past_due", "void", "refunded"] as const;
const PAYMENT_STATUSES = ["succeeded", "pending", "failed", "refunded"] as const;

function qs(base: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v && !(k === "page" && v === "1")) p.set(k, v);
  }
  const s = p.toString();
  return s ? `/saas/billing?${s}` : "/saas/billing";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Billing", "Platform access required.");
  if (!hasSaasPerm(guard.user, "BILLING_VIEW")) return restrictedPanel("Billing", "BILLING_VIEW required.");

  const sp = await searchParams;
  const one = (k: string): string | undefined => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const tab = one("tab") === "payments" ? "payments" : "invoices";
  const status = one("status") ?? "";
  const q = one("q") ?? "";
  const org = one("org") ?? "";
  const page = Math.max(1, Number(one("page") ?? "1") || 1);

  const canManage = hasSaasPerm(guard.user, "BILLING_MANAGE");
  const canRefund = hasSaasPerm(guard.user, "REFUND_APPROVE");
  const baseParams = { tab, status, q, org };

  // Outstanding AR by currency (record-currency aware totals strip).
  const arRows = await invoiceTotals({ status: { in: ["issued", "past_due", "partially_paid"] } });
  const arByCurrency = new Map<string, { cents: number; count: number }>();
  for (const r of arRows) {
    const cur = arByCurrency.get(r.currency) ?? { cents: 0, count: 0 };
    cur.cents += r._sum.amount ?? 0;
    cur.count += r._count._all;
    arByCurrency.set(r.currency, cur);
  }

  const isInvTab = tab === "invoices";
  const skip = (page - 1) * PAGE_SIZE;
  const [invPage, payPage] = await Promise.all([
    isInvTab
      ? listInvoices({ status: status || undefined, q: q || undefined, orgId: org || undefined, take: PAGE_SIZE, skip })
      : Promise.resolve({ items: [], total: 0 }),
    !isInvTab
      ? listPayments({ status: status || undefined, q: q || undefined, orgId: org || undefined, take: PAGE_SIZE, skip })
      : Promise.resolve({ items: [], total: 0 }),
  ]);
  // Invoice picker needs every collectable invoice with its balance.
  const [{ items: orgs }, issuedForPicker, pastDueForPicker, partialForPicker] = await Promise.all([
    listOrganizations({ take: 100 }),
    listInvoices({ status: "issued", take: 100 }),
    listInvoices({ status: "past_due", take: 100 }),
    listInvoices({ status: "partially_paid", take: 100 }),
  ]);

  const pickerInvoices = [...issuedForPicker.items, ...pastDueForPicker.items, ...partialForPicker.items]
    .filter((inv, i, arr) => arr.findIndex((x) => x.id === inv.id) === i)
    .map((inv) => ({
      id: inv.id,
      orgId: inv.organizationId,
      label: `${inv.organization.legalName} · ${formatMoney(inv.amount, inv.currency)} · ${inv.status.replace("_", " ")}`,
      orgName: inv.organization.legalName,
      amountCents: inv.amount,
      currency: inv.currency,
      outstandingCents: inv.amount - inv.payments.filter((p) => p.status === "succeeded").reduce((a, p) => a + p.amount, 0),
    }));

  const invoices: InvoiceView[] = invPage.items.map((i) => ({
    id: i.id,
    orgId: i.organizationId,
    orgName: i.organization.legalName,
    country: i.organization.country,
    type: i.type,
    status: i.status,
    amountCents: i.amount,
    currency: i.currency,
    dueAt: i.dueAt ? i.dueAt.toISOString() : null,
    paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    planName: i.subscription?.plan?.name ?? null,
    payments: i.payments.map((p) => ({
      id: p.id,
      gateway: p.gateway,
      status: p.status,
      amountCents: p.amount,
      currency: p.currency,
      createdAt: p.createdAt.toISOString(),
      failureReason: p.failureReason,
      invoiceId: p.invoiceId,
    })),
  }));
  const payments: PaymentView[] = payPage.items.map((p) => ({
    id: p.id,
    orgId: p.organizationId,
    orgName: p.organization.legalName,
    gateway: p.gateway,
    status: p.status,
    amountCents: p.amount,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    failureReason: p.failureReason,
    invoiceId: p.invoiceId,
    invoiceLabel: p.invoice ? `${formatMoney(p.invoice.amount, p.invoice.currency)} ${p.invoice.status.replace("_", " ")}` : null,
  }));

  const total = isInvTab ? invPage.total : payPage.total;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statuses = isInvTab ? INVOICE_STATUSES : PAYMENT_STATUSES;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Invoices are immutable financial records — corrections happen through voids, refunds and
            re-issues, never edits. All amounts are shown in their record currency.
          </p>
          <Link href="/saas/dunning" className="mt-1 inline-block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Failed payment recovery →
          </Link>
        </div>
        {canManage && <BillingManager orgs={orgs.map((o) => ({ id: o.id, legalName: o.legalName }))} pickerInvoices={pickerInvoices} />}
      </div>

      {/* Totals strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Outstanding AR</p>
          <div className="mt-1.5 space-y-0.5">
            {[...arByCurrency.entries()].map(([cur, v]) => (
              <p key={cur} className="text-lg font-bold tabular-nums">{formatMoney(v.cents, cur)}</p>
            ))}
            {arByCurrency.size === 0 && <p className="text-lg font-bold">{formatMoney(null, null)}</p>}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{[...arByCurrency.values()].reduce((a, v) => a + v.count, 0)} open invoice(s)</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Currencies in use</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...arByCurrency.keys()].map((c) => (
              <span key={c} className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-bold dark:bg-zinc-800">{c}</span>
            ))}
            {arByCurrency.size === 0 && <span className="text-sm text-zinc-400">—</span>}
          </div>
          <p className="mt-1 text-xs text-zinc-400">per-record currency, never converted</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{isInvTab ? "Filtered invoices" : "Filtered payments"}</p>
          <p className="mt-1.5 text-lg font-bold tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-zinc-400">page {page} of {pageCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your permissions</p>
          <div className="mt-1.5 space-y-1 text-xs">
            <p>{canManage ? "✓ Create invoices · record payments · void" : "— View-only billing"}</p>
            <p>{canRefund ? "✓ Approve refunds" : "— Refunds need REFUND_APPROVE"}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["invoices", "payments"] as const).map((t) => (
          <Link key={t}
            href={qs(baseParams, { tab: t, page: undefined })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
              t === tab ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}>{t}</Link>
        ))}
      </div>

      <BillingClient
        tab={tab}
        invoices={invoices}
        payments={payments}
        statuses={[...statuses]}
        currentStatus={status}
        currentQuery={q}
        currentOrg={org}
        orgs={orgs.map((o) => ({ id: o.id, label: o.legalName }))}
        canManage={canManage}
        canRefund={canRefund}
        page={page}
        pageCount={pageCount}
        hrefFor={(patch) => qs(baseParams, patch)}
      />
    </div>
  );
}
