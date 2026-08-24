"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";

type Partner = {
  id: string; name: string; company?: string | null; email: string; country?: string | null;
  type: string; tier: string; status: string; referralCode: string; commissionModel: string; commissionValue: number;
  _count?: { organizations: number; commissions: number };
};

export default function PartnersManager({ initialPartners, initialCommissions, initialPayouts, canManage }: {
  initialPartners: Partner[];
  initialCommissions: { id: string; partnerId?: string | null; amount: number; currency: string; status: string; model: string }[];
  initialPayouts: { id: string; partnerId?: string | null; amount: number; currency: string; status: string; method: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [partners, setPartners] = useState(initialPartners);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ type: "reseller", tier: "bronze", commissionModel: "percent_first", commissionValue: "1500" });
  const [error, setError] = useState("");
  const [payoutPartner, setPayoutPartner] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const refresh = async () => {
    const res = await fetch("/api/saas/partners");
    if (res.ok) { const d = await res.json(); setPartners(d.partners); router.refresh(); }
  };

  const create = async () => {
    setError("");
    const res = await fetch("/api/saas/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, commissionValue: Number(form.commissionValue) }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Create failed"); return; }
    setCreating(false); setForm({ type: "reseller", tier: "bronze", commissionModel: "percent_first", commissionValue: "1500" }); refresh();
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/partners/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Update failed"); return; }
    refresh();
  };

  const requestPayout = async () => {
    const res = await fetch("/api/saas/partners/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partnerId: payoutPartner, amount: Number(payoutAmount) }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Payout failed"); return; }
    setPayoutPartner(""); setPayoutAmount(""); router.refresh();
  };

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><button onClick={() => setCreating(true)} className={btnPrimary}>+ New Partner</button></div>}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">Partner</th><th className="px-3 py-2">Type/Tier</th><th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Customers</th><th className="px-3 py-2">Commission</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th>
          </tr></thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2"><span className="font-medium">{p.name}</span><span className="block text-xs text-zinc-500">{p.company ?? p.email} · {p.country ?? "—"}</span></td>
                <td className="px-3 py-2 text-xs">{p.type} / {p.tier}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.referralCode}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{p._count?.organizations ?? 0}</td>
                <td className="px-3 py-2 text-xs">{p.commissionModel} · {p.commissionValue}</td>
                <td className="px-3 py-2"><StatusBadge domain="payout" status={p.status} /></td>
                <td className="px-3 py-2 space-x-1">
                  {canManage && p.status === "applied" && <button onClick={() => setStatus(p.id, "review")} className={btnGhost}>Review</button>}
                  {canManage && ["applied", "review"].includes(p.status) && <button onClick={() => setStatus(p.id, "approved")} className={btnGhost}>Approve</button>}
                  {canManage && p.status === "approved" && <button onClick={() => setStatus(p.id, "active")} className={btnGhost}>Activate</button>}
                  {canManage && p.status === "active" && <button onClick={() => setStatus(p.id, "suspended")} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600">Suspend</button>}
                </td>
              </tr>
            ))}
            {partners.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No partners yet</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-sm font-bold">Commissions ({initialCommissions.length})</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {initialCommissions.slice(0, 10).map((c) => (
              <li key={c.id} className="flex justify-between"><span>{(c.partnerId ?? "").slice(0, 8)} · {c.model} · {formatMoney(c.amount, c.currency)}</span><StatusBadge domain="commission" status={c.status} /></li>
            ))}
            {initialCommissions.length === 0 && <li className="text-zinc-400">None yet — created automatically when a partner-sourced customer subscribes.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-sm font-bold">Payouts ({initialPayouts.length})</h3>
          {canManage && (
            <div className="mt-2 flex gap-2">
              <select className="flex-1 rounded-lg border px-2 py-1 text-xs dark:bg-zinc-800" value={payoutPartner} onChange={(e) => setPayoutPartner(e.target.value)}>
                <option value="">Select partner…</option>
                {partners.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="w-24 rounded-lg border px-2 py-1 text-xs dark:bg-zinc-800" placeholder="cents" type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
              <button className={btnGhost} disabled={!payoutPartner || !Number(payoutAmount)} onClick={requestPayout}>+ Payout</button>
            </div>
          )}
          <ul className="mt-2 space-y-1 text-xs">
            {initialPayouts.slice(0, 10).map((p) => (
              <li key={p.id} className="flex justify-between"><span>{(p.partnerId ?? "").slice(0, 8)} · {formatMoney(p.amount, p.currency)} · {p.method}</span><StatusBadge domain="payout" status={p.status} /></li>
            ))}
            {initialPayouts.length === 0 && <li className="text-zinc-400">No payouts yet</li>}
          </ul>
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New Partner">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required><input className={inputCls} value={form.name ?? ""} onChange={set("name")} /></Field>
            <Field label="Email" required><input className={inputCls} type="email" value={form.email ?? ""} onChange={set("email")} /></Field>
            <Field label="Company"><input className={inputCls} value={form.company ?? ""} onChange={set("company")} /></Field>
            <Field label="Country"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} /></Field>
            <Field label="Type"><select className={inputCls} value={form.type} onChange={set("type")}><option value="it_agency">IT agency</option><option value="consultant">consultant</option><option value="reseller">reseller</option><option value="implementation">implementation</option><option value="hmc">hotel mgmt company</option></select></Field>
            <Field label="Tier"><select className={inputCls} value={form.tier} onChange={set("tier")}><option value="bronze">bronze</option><option value="silver">silver</option><option value="gold">gold</option><option value="platinum">platinum</option></select></Field>
            <Field label="Commission model"><select className={inputCls} value={form.commissionModel} onChange={set("commissionModel")}><option value="fixed">fixed</option><option value="percent_first">percent first payment</option><option value="percent_mrr_12">% of 12mo MRR</option><option value="percent_mrr_recurring">recurring %</option></select></Field>
            <Field label="Value (cents/bps)"><input className={inputCls} type="number" value={form.commissionValue ?? ""} onChange={set("commissionValue")} /></Field>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setCreating(false)}>Cancel</button>
            <button className={btnPrimary} disabled={!form.name || !form.email} onClick={create}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
