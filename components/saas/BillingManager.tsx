"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";

export default function BillingManager({ orgs }: { orgs: { id: string; legalName: string }[] }) {
  const router = useRouter();
  const [invOpen, setInvOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const createInvoice = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/saas/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: form.organizationId, amount: Math.round(Number(form.amount) * 100), currency: form.currency || "USD", type: form.type || "subscription", dueAt: form.dueAt || undefined, idempotencyKey: form.idempotencyKey || undefined }) });
    const d = await res.json().catch(()=>({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Create failed"); return; }
    setInvOpen(false); router.refresh();
  };

  const recordPayment = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/saas/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: form.organizationId, invoiceId: form.invoiceId || undefined, amount: Math.round(Number(form.amount) * 100), gateway: form.gateway || "manual", idempotencyKey: form.idempotencyKey || undefined }) });
    const d = await res.json().catch(()=>({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Payment failed"); return; }
    setPayOpen(false); router.refresh();
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => setInvOpen(true)} className={btnPrimary}>+ New Invoice</button>
      <button onClick={() => setPayOpen(true)} className={btnGhost}>Record Payment</button>

      <Modal open={invOpen} onClose={() => setInvOpen(false)} title="New Invoice (immutable)">
        <div className="space-y-3">
          <Field label="Organization" required>
            <select className={inputCls} value={form.organizationId ?? ""} onChange={set("organizationId")}>
              <option value="">Select org</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount $"><input className={inputCls} type="number" step="0.01" value={form.amount ?? ""} onChange={set("amount")} /></Field>
            <Field label="Currency"><input className={inputCls} value={form.currency ?? "USD"} onChange={set("currency")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={inputCls} value={form.type ?? "subscription"} onChange={set("type")}><option value="subscription">subscription</option><option value="addon">addon</option><option value="usage">usage</option><option value="onetime">onetime</option><option value="credit">credit</option></select></Field>
            <Field label="Due At"><input className={inputCls} type="date" value={form.dueAt ?? ""} onChange={set("dueAt")} /></Field>
          </div>
          <Field label="Idempotency Key (duplicate webhook protection)"><input className={inputCls} value={form.idempotencyKey ?? ""} onChange={set("idempotencyKey")} placeholder="optional, prevents double invoice" /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={()=>setInvOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy || !form.organizationId || !form.amount} onClick={createInvoice}>{busy?"Creating…":"Create Invoice"}</button></div>
        </div>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <Field label="Organization" required>
            <select className={inputCls} value={form.organizationId ?? ""} onChange={set("organizationId")}>
              <option value="">Select org</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
            </select>
          </Field>
          <Field label="Invoice ID (optional)"><input className={inputCls} value={form.invoiceId ?? ""} onChange={set("invoiceId")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount $"><input className={inputCls} type="number" step="0.01" value={form.amount ?? ""} onChange={set("amount")} /></Field>
            <Field label="Gateway"><select className={inputCls} value={form.gateway ?? "manual"} onChange={set("gateway")}><option value="manual">manual</option><option value="stripe">stripe</option><option value="razorpay">razorpay</option></select></Field>
          </div>
          <Field label="Idempotency Key"><input className={inputCls} value={form.idempotencyKey ?? ""} onChange={set("idempotencyKey")} placeholder="prevents double payment" /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={()=>setPayOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy || !form.organizationId || !form.amount} onClick={recordPayment}>{busy?"Recording…":"Record Payment"}</button></div>
        </div>
      </Modal>
    </div>
  );
}
