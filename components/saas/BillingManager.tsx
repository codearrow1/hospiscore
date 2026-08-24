"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";

type PickerInvoice = {
  id: string;
  orgId: string;
  label: string;
  orgName: string;
  amountCents: number;
  currency: string;
  outstandingCents: number;
};

export default function BillingManager({ orgs, pickerInvoices = [] }: {
  orgs: { id: string; legalName: string }[];
  /** Collectable invoices for the payment picker (id → human label + balance). */
  pickerInvoices?: PickerInvoice[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [invOpen, setInvOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickedInvoice = pickerInvoices.find((i) => i.id === form.invoiceId) ?? null;

  const createInvoice = async () => {
    setBusy(true); setError("");
    try {
      const major = Number(form.amount);
      if (form.amount === "" || !Number.isFinite(major)) { setError("Enter a valid amount"); return; }
      const res = await fetch("/api/saas/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: form.organizationId,
          amount: Math.round(major * 100),
          currency: form.currency || "USD",
          type: form.type || "subscription",
          dueAt: form.dueAt || undefined,
          idempotencyKey: form.idempotencyKey || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Create failed"); return; }
      toast.success("Invoice created");
      setInvOpen(false); setForm({}); router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!pickedInvoice) { setError("Select the invoice this payment settles"); return; }
    setBusy(true); setError("");
    try {
      const major = Number(form.amount);
      if (form.amount === "" || !Number.isFinite(major)) { setError("Enter a valid amount"); return; }
      const res = await fetch("/api/saas/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: pickedInvoice.orgId,
          invoiceId: pickedInvoice.id,
          amount: Math.round(major * 100),
          gateway: form.gateway || "manual",
          idempotencyKey: form.idempotencyKey || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Payment failed"); return; }
      toast.success("Payment recorded");
      setPayOpen(false); setForm({}); router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => { setForm({}); setInvOpen(true); }} className={btnPrimary}>+ New Invoice</button>
      <button onClick={() => { setForm({}); setPayOpen(true); }} className={btnGhost}>Record Payment</button>

      <Modal open={invOpen} onClose={() => setInvOpen(false)} title="New Invoice (immutable)">
        <div className="space-y-3">
          <Field label="Organization" required>
            <select className={inputCls} value={form.organizationId ?? ""} onChange={set("organizationId")}>
              <option value="">Select org</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount (${form.currency || "USD"})`}><input className={inputCls} type="number" step="0.01" value={form.amount ?? ""} onChange={set("amount")} /></Field>
            <Field label="Currency"><input className={inputCls} value={form.currency ?? "USD"} onChange={set("currency")} maxLength={3} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={inputCls} value={form.type ?? "subscription"} onChange={set("type")}><option value="subscription">subscription</option><option value="addon">addon</option><option value="usage">usage</option><option value="onetime">onetime</option><option value="credit">credit</option></select></Field>
            <Field label="Due At"><input className={inputCls} type="date" value={form.dueAt ?? ""} onChange={set("dueAt")} /></Field>
          </div>
          <Field label="Idempotency Key (duplicate webhook protection)"><input className={inputCls} value={form.idempotencyKey ?? ""} onChange={set("idempotencyKey")} placeholder="optional, prevents double invoice" /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setInvOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy || !form.organizationId || !form.amount} onClick={createInvoice}>{busy ? "Creating…" : "Create Invoice"}</button></div>
        </div>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <Field label="Invoice" required>
            <select className={inputCls} value={form.invoiceId ?? ""} onChange={(e) => {
              const inv = pickerInvoices.find((x) => x.id === e.target.value);
              // Prefill the outstanding balance — recording less is a partial payment.
              setForm((f) => ({ ...f, invoiceId: e.target.value, amount: inv && inv.outstandingCents > 0 ? String(inv.outstandingCents / 100) : f.amount }));
            }}>
              <option value="">— select collectable invoice —</option>
              {pickerInvoices.map((i) => (
                <option key={i.id} value={i.id}>{i.label} · outstanding {formatMoney(i.outstandingCents, i.currency)}</option>
              ))}
            </select>
          </Field>
          {pickedInvoice && (
            <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/60">
              {pickedInvoice.orgName} · total {formatMoney(pickedInvoice.amountCents, pickedInvoice.currency)} ·{" "}
              outstanding <strong>{formatMoney(pickedInvoice.outstandingCents, pickedInvoice.currency)}</strong>
              <span className="block text-zinc-400">Payment currency follows the invoice ({pickedInvoice.currency}); overpayments are rejected by the ledger.</span>
            </div>
          )}
          <Field label={`Amount (${pickedInvoice?.currency ?? "invoice currency"})`} required><input className={inputCls} type="number" step="0.01" min="0" value={form.amount ?? ""} onChange={set("amount")} /></Field>
          <Field label="Gateway"><select className={inputCls} value={form.gateway ?? "manual"} onChange={set("gateway")}><option value="manual">manual</option><option value="stripe">stripe</option><option value="razorpay">razorpay</option></select></Field>
          <Field label="Idempotency Key"><input className={inputCls} value={form.idempotencyKey ?? ""} onChange={set("idempotencyKey")} placeholder="prevents double payment" /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setPayOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy || !pickedInvoice || !form.amount} onClick={recordPayment}>{busy ? "Recording…" : "Record Payment"}</button></div>
        </div>
      </Modal>
    </div>
  );
}
