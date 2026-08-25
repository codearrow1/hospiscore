"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DetailDrawer, DrawerSection, KeyValue } from "@/components/ui/DetailDrawer";
import { Pagination, FilterChip } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/marketing-admin/ui";
import { btnGhost, btnPrimary, Field, inputCls } from "@/components/marketing-admin/ui";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { modalFooterCls } from "@/components/ui/AccessibleModal";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 25;

export type PaymentView = {
  id: string; orgId?: string; orgName?: string; gateway: string; status: string;
  amountCents: number; currency: string; createdAt: string;
  failureReason?: string | null; invoiceId: string | null; invoiceLabel?: string | null;
};
export type InvoiceView = {
  id: string; orgId: string; orgName: string; country?: string | null; type: string; status: string;
  amountCents: number; currency: string;
  dueAt: string | null; paidAt: string | null; createdAt: string;
  planName: string | null; payments: PaymentView[];
};

const VOIDABLE = ["issued", "past_due", "partially_paid"];

function fmtDue(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days > 0) return `${days}d overdue`;
  return `due in ${Math.abs(days)}d`;
}

export default function BillingClient({
  tab, invoices, payments, statuses, currentStatus, currentQuery, currentOrg,
  orgs, canManage, canRefund, page, pageCount, hrefFor,
}: {
  tab: "invoices" | "payments";
  invoices: InvoiceView[];
  payments: PaymentView[];
  statuses: string[];
  currentStatus: string;
  currentQuery: string;
  currentOrg: string;
  orgs: { id: string; label: string }[];
  canManage: boolean;
  canRefund: boolean;
  page: number;
  pageCount: number;
  hrefFor: (patch: Record<string, string | undefined>) => string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<InvoiceView | null>(null);
  const [voiding, setVoiding] = useState<InvoiceView | null>(null);
  const [refunding, setRefunding] = useState<PaymentView | null>(null);
  const [payFor, setPayFor] = useState<InvoiceView | null>(null);
  const [payForm, setPayForm] = useState<{ amount: string; gateway: string; key: string }>({ amount: "", gateway: "manual", key: "" });
  const [busy, setBusy] = useState(false);

  const voidInvoice = async () => {
    if (!voiding) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/saas/invoices/${voiding.id}/void`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Void failed"); return; }
      toast.success("Invoice voided");
      setVoiding(null);
      setDetail(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const refundPayment = async () => {
    if (!refunding) return;
    setBusy(true);
    try {
      const res = await fetch("/api/saas/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", paymentId: refunding.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Refund failed"); return; }
      toast.success("Payment refunded — commissions reversed where applicable");
      setRefunding(null);
      setDetail(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!payFor) return;
    setBusy(true);
    try {
      // Amount input is in MAJOR units of the invoice currency; API takes minor.
      const major = Number(payForm.amount);
      if (!Number.isFinite(major) || payForm.amount === "") { toast.error("Enter a valid amount"); return; }
      const res = await fetch("/api/saas/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: payFor.orgId, invoiceId: payFor.id,
          amount: Math.round(major * 100), gateway: payForm.gateway || "manual",
          idempotencyKey: payForm.key || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Payment failed"); return; }
      toast.success("Payment recorded");
      setPayFor(null);
      setPayForm({ amount: "", gateway: "manual", key: "" });
      setDetail(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const filterActiveCount = (currentOrg ? 1 : 0) + (currentQuery ? 1 : 0) + (currentStatus ? 1 : 0);
  const filterBase = tab === "invoices" ? invoices : payments;
  const rowsHaveCurrencySpread = new Set(filterBase.map((r) => r.currency)).size;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form action="/saas/billing" className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="status" value={currentStatus} />
          <input type="hidden" name="org" value={currentOrg} />
          <input name="q" defaultValue={currentQuery} placeholder={tab === "invoices" ? "Search org or invoice id…" : "Search org or payment id…"}
            className={`${inputCls} min-w-0 flex-1 py-1.5 text-xs sm:w-64 sm:flex-none`} />
        </form>
        <FilterSheet
          label="Filters"
          activeCount={filterActiveCount}
          onClearAll={() => router.push(hrefFor({ org: undefined, q: undefined, status: undefined, page: undefined }))}
        >
          <Field label="Organization">
            <select aria-label="Organization filter" className={inputCls} value={currentOrg}
              onChange={(e) => router.push(hrefFor({ org: e.target.value || undefined, page: undefined }))}>
              <option value="">All organizations</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <p className="text-xs text-zinc-500">Status is filtered with the chips beside the search box.</p>
        </FilterSheet>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={!currentStatus} href={hrefFor({ status: undefined, page: undefined })}>all</FilterChip>
          {statuses.map((s) => (
            <FilterChip key={s} active={currentStatus === s} href={hrefFor({ status: s, page: undefined })}>{s.replace("_", " ")}</FilterChip>
          ))}
        </div>
      </div>

      {/* Invoices table */}
      {tab === "invoices" && (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {invoices.map((inv) => {
              const paidCents = inv.payments.filter((p) => p.status === "succeeded").reduce((a, p) => a + p.amountCents, 0);
              const overdue = inv.dueAt && !["paid", "void", "refunded"].includes(inv.status) && new Date(inv.dueAt).getTime() < Date.now();
              return (
                <li key={inv.id}>
                  <button
                    onClick={() => setDetail(inv)}
                    className={`w-full rounded-xl border border-zinc-200 bg-white p-3 text-left text-sm dark:border-zinc-800 dark:bg-zinc-900 ${overdue ? "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/10" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{inv.orgName}</p>
                        <p className="truncate text-xs text-zinc-500">{inv.type} · {formatDate(inv.createdAt)}{inv.planName ? ` · ${inv.planName}` : ""}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(inv.amountCents, inv.currency)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge domain="invoice" status={inv.status} />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">{paidCents > 0 ? `${formatMoney(paidCents, inv.currency)} paid` : "nothing paid"}</span>
                      {inv.status !== "paid" && inv.dueAt && <span className={`text-xs ${overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-400"}`}>{fmtDue(inv.dueAt)}</span>}
                      {inv.payments.length > 0 && <span className="text-xs text-zinc-400">{inv.payments.length} payment{inv.payments.length === 1 ? "" : "s"}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
            {invoices.length === 0 && (
              <li className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-400 dark:border-zinc-800">No invoices match these filters.</li>
            )}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-3 py-2">Customer</th><th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Amount</th><th className="px-3 py-2">Paid</th><th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Due</th><th className="px-3 py-2">Payments</th>
            </tr></thead>
            <tbody>
              {invoices.map((inv) => {
                const paidCents = inv.payments.filter((p) => p.status === "succeeded").reduce((a, p) => a + p.amountCents, 0);
                const overdue = inv.dueAt && !["paid", "void", "refunded"].includes(inv.status) && new Date(inv.dueAt).getTime() < Date.now();
                return (
                  <tr key={inv.id} onClick={() => setDetail(inv)}
                    className={`cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 ${overdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                    <td className="px-3 py-2"><span className="font-medium">{inv.orgName}</span>{inv.planName && <span className="block text-xs text-zinc-400">{inv.planName}</span>}</td>
                    <td className="px-3 py-2 text-xs capitalize">{inv.type}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{formatMoney(inv.amountCents, inv.currency)}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-emerald-600 dark:text-emerald-400">{paidCents > 0 ? formatMoney(paidCents, inv.currency) : "—"}</td>
                    <td className="px-3 py-2"><StatusBadge domain="invoice" status={inv.status} /></td>
                    <td className="px-3 py-2 text-xs">
                      {inv.status === "paid" && inv.paidAt ? <>paid {formatDate(inv.paidAt)}</> : inv.dueAt ? <span className={overdue ? "font-semibold text-red-600 dark:text-red-400" : ""}>{fmtDue(inv.dueAt)}</span> : "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-xs tabular-nums">{inv.payments.length}</td>
                  </tr>
                );
              })}
              {invoices.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No invoices match these filters.</td></tr>}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Payments table */}
      {tab === "payments" && (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {payments.map((p) => (
              <li key={p.id} className={`rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 ${p.status === "failed" ? "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/10" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.orgName}</p>
                    {p.failureReason && <p className="truncate text-xs text-red-500">{p.failureReason}</p>}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(p.amountCents, p.currency)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge domain="payment" status={p.status} />
                  <span className="text-xs capitalize text-zinc-500">{p.gateway}</span>
                  <span className="text-xs text-zinc-400">{formatDateTime(p.createdAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
                  <span className="truncate text-xs text-zinc-500">{p.invoiceLabel ?? "unallocated"}</span>
                  {canRefund && p.status === "succeeded" && (
                    <button onClick={() => setRefunding(p)} disabled={busy}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40">
                      Refund
                    </button>
                  )}
                </div>
              </li>
            ))}
            {payments.length === 0 && (
              <li className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-400 dark:border-zinc-800">No payments match these filters.</li>
            )}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-3 py-2">Customer</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Gateway</th>
              <th className="px-3 py-2">Status</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th>{canRefund && <th className="px-3 py-2"></th>}
            </tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${p.status === "failed" ? "bg-red-50/40 dark:bg-red-950/10" : ""} dark:border-zinc-800/60`}>
                  <td className="px-3 py-2 font-medium">{p.orgName}{p.failureReason && <span className="block text-xs text-red-500">{p.failureReason}</span>}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{formatMoney(p.amountCents, p.currency)}</td>
                  <td className="px-3 py-2 text-xs capitalize">{p.gateway}</td>
                  <td className="px-3 py-2"><StatusBadge domain="payment" status={p.status} /></td>
                  <td className="px-3 py-2 text-xs">{p.invoiceLabel ?? <span className="text-zinc-400">unallocated</span>}</td>
                  <td className="px-3 py-2 text-xs">{formatDateTime(p.createdAt)}</td>
                  {canRefund && (
                    <td className="px-3 py-2 text-right">
                      {p.status === "succeeded" && (
                        <button onClick={() => setRefunding(p)} disabled={busy}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40">
                          Refund
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={canRefund ? 7 : 6} className="px-3 py-6 text-center text-sm text-zinc-400">No payments match these filters.</td></tr>}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={pageCount} perPage={PAGE_SIZE} total={filterBase.length ? undefined : 0} makeHref={(p) => hrefFor({ page: p > 1 ? String(p) : undefined })} />
      {rowsHaveCurrencySpread > 1 && (
        <p className="text-xs text-zinc-400">Mixed currencies in this view — every amount is shown in its own record currency.</p>
      )}

      {/* Invoice detail drawer */}
      <DetailDrawer open={detail !== null} onClose={() => setDetail(null)} title={`Invoice ${detail?.id.slice(0, 12)}…`} subtitle={detail ? `${detail.orgName} · ${detail.type}` : undefined} width="lg">
        {detail && (
          <div className="space-y-4">
            <DrawerSection title="Details">
              <KeyValue label="Customer"><Link href={`/saas/organizations/${detail.orgId}`} className="text-blue-600 hover:underline dark:text-blue-400">{detail.orgName}</Link></KeyValue>
              <KeyValue label="Amount"><span className="text-base font-bold">{formatMoney(detail.amountCents, detail.currency)}</span></KeyValue>
              <KeyValue label="Status"><StatusBadge domain="invoice" status={detail.status} /></KeyValue>
              <KeyValue label="Plan">{detail.planName ?? "—"}</KeyValue>
              <KeyValue label="Created">{formatDateTime(detail.createdAt)}</KeyValue>
              <KeyValue label="Due">{detail.dueAt ? formatDate(detail.dueAt) : "—"}</KeyValue>
              <KeyValue label="Paid at">{detail.paidAt ? formatDateTime(detail.paidAt) : "—"}</KeyValue>
            </DrawerSection>

            <DrawerSection title={`Payment history (${detail.payments.length})`}>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-zinc-400">No payments recorded against this invoice.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                      <div>
                        <p className="text-sm font-semibold tabular-nums">{formatMoney(p.amountCents, p.currency)}</p>
                        <p className="text-xs text-zinc-400">{p.gateway} · {formatDate(p.createdAt)}{p.failureReason ? ` · ${p.failureReason}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge domain="payment" status={p.status} />
                        {canRefund && p.status === "succeeded" && (
                          <button onClick={() => setRefunding(p)} disabled={busy}
                            className="rounded-lg border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40">Refund</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>

            {canManage && VOIDABLE.includes(detail.status) && (
              <DrawerSection title="Actions">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setPayFor(detail); setPayForm({ amount: "", gateway: "manual", key: "" }); }} className={btnPrimary}>Record payment</button>
                  <button onClick={() => setVoiding(detail)} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40">Void invoice</button>
                </div>
                <p className="mt-2 text-xs text-zinc-400">Voids close any open dunning case on this invoice. Paid invoices must be refunded instead.</p>
              </DrawerSection>
            )}
            {!canManage && VOIDABLE.includes(detail.status) && (
              <p className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-400 dark:bg-zinc-800/50">BILLING_MANAGE is required to record payments or void this invoice.</p>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* Inline record-payment modal (prefilled from drawer) */}
      <Modal open={payFor !== null} onClose={() => setPayFor(null)} title="Record payment">
        {payFor && (
          <div className="space-y-3">
            <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
              <p className="font-medium">{payFor.orgName}</p>
              <p className="text-xs text-zinc-500">
                Invoice total {formatMoney(payFor.amountCents, payFor.currency)} · outstanding{" "}
                <strong>{formatMoney(Math.max(0, payFor.amountCents - payFor.payments.filter((p) => p.status === "succeeded").reduce((a, p) => a + p.amountCents, 0)), payFor.currency)}</strong>
              </p>
            </div>
            <Field label={`Amount (${payFor.currency})`} required><input className={inputCls} type="number" inputMode="decimal" step="0.01" min="0" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
            <Field label="Gateway">
              <select className={inputCls} value={payForm.gateway} onChange={(e) => setPayForm((f) => ({ ...f, gateway: e.target.value }))}>
                <option value="manual">manual</option><option value="stripe">stripe</option><option value="razorpay">razorpay</option>
              </select>
            </Field>
            <Field label="Idempotency key (optional)"><input className={inputCls} value={payForm.key} onChange={(e) => setPayForm((f) => ({ ...f, key: e.target.value }))} placeholder="prevents double recording" /></Field>
            <div className={modalFooterCls}>
              <button className={btnGhost} onClick={() => setPayFor(null)}>Cancel</button>
              <button className={btnPrimary} disabled={busy || !payForm.amount} onClick={recordPayment}>{busy ? "Recording…" : "Record payment"}</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        action={voiding
          ? {
              title: "Void invoice",
              message: `${voiding.orgName} — ${formatMoney(voiding.amountCents, voiding.currency)}`,
              consequences: [
                "The invoice becomes permanently void and uncollectable.",
                "Any open dunning case for this invoice is closed immediately.",
                "This is recorded on the audit log under your account.",
              ],
              confirmLabel: "Void invoice",
              tone: "danger",
            }
          : null}
        onClose={() => setVoiding(null)}
        onConfirm={() => voidInvoice()}
      />

      <ConfirmDialog
        action={refunding
          ? {
              title: "Refund payment",
              message: `${refunding.orgName ?? "Customer"} — ${formatMoney(refunding.amountCents, refunding.currency)} via ${refunding.gateway}`,
              consequences: [
                "The payment is marked refunded and the invoice balance reopens.",
                "Affiliate commissions tied to this subscription are reversed.",
                "This is recorded on the audit log under your account.",
              ],
              confirmLabel: "Refund",
              tone: "danger",
            }
          : null}
        onClose={() => setRefunding(null)}
        onConfirm={() => refundPayment()}
      />
    </div>
  );
}

