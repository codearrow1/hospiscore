"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";

type Aff = { id: string; name: string; email: string; status: string; referralCode: string; tier: string; commissionModel: string; commissionValue: number; website?: string | null; country?: string | null };

export default function AffiliatesManager({ initialAffiliates, initialCommissions, initialPayouts, canManage, canApprove, canPayout }: {
  initialAffiliates: Aff[];
  initialCommissions: { id: string; affiliateId: string; amount: number; currency: string; status: string; model: string }[];
  initialPayouts: { id: string; affiliateId: string; amount: number; currency: string; status: string }[];
  canManage: boolean; canApprove: boolean; canPayout: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [affiliates, setAffiliates] = useState(initialAffiliates);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payoutAff, setPayoutAff] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const refresh = async () => {
    const res = await fetch("/api/saas/affiliates");
    if (res.ok) { const d = await res.json(); setAffiliates(d.affiliates); router.refresh(); }
  };

  const create = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/saas/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, businessName: form.businessName, country: form.country, website: form.website, tier: form.tier || "standard", commissionModel: form.commissionModel || "percent_mrr_12", commissionValue: form.commissionValue ? Number(form.commissionValue) : 2000 }) });
      const d = await res.json().catch(()=>({}));
      if (!res.ok) { setError(d.error ?? "Create failed"); return; }
      setCreating(false); setForm({}); refresh();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/affiliates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json().catch(()=>({})); toast.error(d.error ?? "Update failed"); return; }
    refresh();
  };

  const createPayout = async () => {
    const res = await fetch("/api/saas/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affiliateId: payoutAff, amount: Number(payoutAmount) }) });
    if (!res.ok) { const d = await res.json().catch(()=>({})); toast.error(d.error ?? "Payout failed"); return; }
    setPayoutAff(""); setPayoutAmount(""); router.refresh();
  };

  const referralLink = (code: string) => `${typeof window !== "undefined" ? window.location.origin : "https://thebuddharice.online"}/?ref=${code}`;

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><button onClick={() => setCreating(true)} className={btnPrimary}>+ New Affiliate</button></div>}

      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400"><th className="px-3 py-2">Affiliate</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Link</th><th className="px-3 py-2">Tier</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2"><span className="font-medium">{a.name}</span><span className="block text-xs text-zinc-500">{a.email} · {a.country || "—"}</span></td>
                <td className="px-3 py-2 font-mono text-xs">{a.referralCode}</td>
                <td className="px-3 py-2 text-xs"><a href={referralLink(a.referralCode)} target="_blank" className="text-indigo-600 hover:underline">{referralLink(a.referralCode)}</a></td>
                <td className="px-3 py-2 text-xs">{a.tier} · {a.commissionModel} {a.commissionValue}</td>
                <td className="px-3 py-2"><Badge>{a.status}</Badge></td>
                <td className="px-3 py-2">
                  {canApprove && a.status === "applied" && <button onClick={() => setStatus(a.id, "review")} className={btnGhost}>Review</button>}
                  {canApprove && (a.status === "review" || a.status === "applied") && <button onClick={() => setStatus(a.id, "approved")} className={btnGhost}>Approve</button>}
                  {canApprove && a.status === "approved" && <button onClick={() => setStatus(a.id, "active")} className={btnGhost}>Activate</button>}
                  {canApprove && a.status === "active" && <button onClick={() => setStatus(a.id, "suspended")} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600">Suspend</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-sm font-bold">Commissions ({initialCommissions.length})</h3>
          <p className="text-xs text-zinc-500">Pending→Eligible→Approved→Payable→Paid; reverses on refund/chargeback.</p>
          <ul className="mt-2 space-y-1 text-xs">
            {initialCommissions.slice(0, 10).map((c) => <li key={c.id} className="flex justify-between"><span>{c.affiliateId.slice(0,6)} · {c.model} {formatMoney(c.amount, c.currency)}</span><StatusBadge domain="commission" status={c.status} /></li>)}
            {initialCommissions.length===0 && <li className="text-zinc-400">No commissions yet</li>}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-sm font-bold">Payouts ({initialPayouts.length})</h3>
          <p className="text-xs text-zinc-500">Requested→Approved→Processing→Paid→Failed (UPI/Bank/PayPal)</p>
          {canPayout && (
            <div className="mt-2 flex gap-2">
              <select className="flex-1 rounded-lg border px-2 py-1 text-xs dark:bg-zinc-800" value={payoutAff} onChange={(e) => setPayoutAff(e.target.value)}>
                <option value="">Select affiliate…</option>
                {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input className="w-24 rounded-lg border px-2 py-1 text-xs dark:bg-zinc-800" placeholder="cents" type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
              <button className={btnGhost} disabled={!payoutAff || !Number(payoutAmount)} onClick={createPayout}>+ Payout</button>
            </div>
          )}
          <ul className="mt-2 space-y-1 text-xs">
            {initialPayouts.slice(0,10).map((p)=><li key={p.id} className="flex justify-between"><span>{p.affiliateId.slice(0,6)} {formatMoney(p.amount, p.currency)}</span><StatusBadge domain="payout" status={p.status} /></li>)}
            {initialPayouts.length===0 && <li className="text-zinc-400">No payouts yet</li>}
          </ul>
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New Affiliate">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required><input className={inputCls} value={form.name ?? ""} onChange={set("name")} /></Field>
            <Field label="Email" required><input className={inputCls} type="email" value={form.email ?? ""} onChange={set("email")} /></Field>
            <Field label="Business"><input className={inputCls} value={form.businessName ?? ""} onChange={set("businessName")} /></Field>
            <Field label="Country"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} /></Field>
            <Field label="Website"><input className={inputCls} value={form.website ?? ""} onChange={set("website")} /></Field>
            <Field label="Tier"><select className={inputCls} value={form.tier ?? "standard"} onChange={set("tier")}><option value="standard">standard</option><option value="silver">silver</option><option value="gold">gold</option><option value="platinum">platinum</option></select></Field>
            <Field label="Commission Model"><select className={inputCls} value={form.commissionModel ?? "percent_mrr_12"} onChange={set("commissionModel")}><option value="fixed">fixed</option><option value="percent_first">percent_first</option><option value="percent_mrr_12">percent_mrr_12</option><option value="percent_mrr_recurring">recurring</option></select></Field>
            <Field label="Value (cents/bps)"><input className={inputCls} type="number" value={form.commissionValue ?? "2000"} onChange={set("commissionValue")} /></Field>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={()=>setCreating(false)}>Cancel</button><button className={btnPrimary} disabled={busy||!form.name||!form.email} onClick={create}>{busy?"Creating…":"Create"}</button></div>
        </div>
      </Modal>
    </div>
  );
}
