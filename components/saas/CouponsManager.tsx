"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Coupon = {
  id: string; code: string; description?: string | null; type: string; value: number;
  duration: string; months?: number | null; maxRedemptions?: number | null; redeemedCount: number;
  totalDiscounted?: number; expiresAt?: string | null; isActive: boolean;
};

export default function CouponsManager({ initialCoupons, canManage }: { initialCoupons: Coupon[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ type: "percent", duration: "once" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const refresh = async () => {
    const res = await fetch("/api/saas/coupons");
    if (res.ok) { const d = await res.json(); setCoupons(d.coupons); router.refresh(); }
  };

  const create = async () => {
    setBusy(true); setError("");
    const body: Record<string, unknown> = {
      code: form.code || undefined,
      description: form.description || undefined,
      type: form.type,
      value: Number(form.value),
      duration: form.duration,
    };
    if (form.duration === "repeating") body.months = Number(form.months);
    if (form.maxRedemptions) body.maxRedemptions = Number(form.maxRedemptions);
    if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
    try {
      const res = await fetch("/api/saas/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Create failed"); return; }
      setCreating(false); setForm({ type: "percent", duration: "once" }); refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/saas/coupons/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Update failed"); return; }
    setArchiving(null);
    refresh();
  };

  const fmtValue = (c: Coupon) => (c.type === "percent" ? `${(c.value / 100).toFixed(c.value % 100 ? 2 : 0)}%` : `$${(c.value / 100).toFixed(2)}`);

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><button onClick={() => setCreating(true)} className={btnPrimary}>+ New Coupon</button></div>}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">Code</th><th className="px-3 py-2">Discount</th><th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Redeemed</th><th className="px-3 py-2">Total Discounted</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2"><span className="font-mono font-medium">{c.code}</span>{c.description && <span className="block text-xs text-zinc-500">{c.description}</span>}</td>
                <td className="px-3 py-2">{fmtValue(c)}</td>
                <td className="px-3 py-2 text-xs">{c.duration}{c.duration === "repeating" && c.months ? ` (${c.months}mo)` : ""}</td>
                <td className="px-3 py-2 text-xs">{c.redeemedCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                <td className="px-3 py-2 text-xs">${((c.totalDiscounted ?? 0) / 100).toFixed(2)}</td>
                <td className="px-3 py-2"><Badge>{c.isActive ? "active" : "archived"}</Badge></td>
                <td className="px-3 py-2">
                  {canManage && (c.isActive
                    ? <button onClick={() => setArchiving(c)} className={btnGhost}>Archive</button>
                    : <button onClick={() => toggle(c.id, true)} className={btnGhost}>Activate</button>)}
                </td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No coupons yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New Coupon">

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code (blank = auto)"><input className={inputCls} value={form.code ?? ""} onChange={set("code")} /></Field>
            <Field label="Description"><input className={inputCls} value={form.description ?? ""} onChange={set("description")} /></Field>
            <Field label="Type" required><select className={inputCls} value={form.type} onChange={set("type")}><option value="percent">percent</option><option value="fixed">fixed (cents)</option></select></Field>
            <Field label={form.type === "percent" ? "Value (bps: 2000 = 20%)" : "Value (cents)"} required><input className={inputCls} type="number" value={form.value ?? ""} onChange={set("value")} /></Field>
            <Field label="Duration" required><select className={inputCls} value={form.duration} onChange={set("duration")}><option value="once">once</option><option value="repeating">repeating</option><option value="forever">forever</option></select></Field>
            {form.duration === "repeating" && <Field label="Months" required><input className={inputCls} type="number" min={1} max={36} value={form.months ?? ""} onChange={set("months")} /></Field>}
            <Field label="Max redemptions"><input className={inputCls} type="number" min={1} value={form.maxRedemptions ?? ""} onChange={set("maxRedemptions")} /></Field>
            <Field label="Expires at"><input className={inputCls} type="date" value={form.expiresAt ?? ""} onChange={set("expiresAt")} /></Field>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setCreating(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy || !form.value} onClick={create}>{busy ? "Creating…" : "Create"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        action={archiving
          ? {
              title: "Archive coupon",
              message: `Archive "${archiving.code}"?`,
              consequences: [
                "The code stops applying at checkout immediately.",
                "Past redemptions and reporting history are kept.",
                "You can reactivate it later from this list.",
              ],
              confirmLabel: "Archive",
              tone: "warning",
            }
          : null}
        onClose={() => setArchiving(null)}
        onConfirm={() => archiving && toggle(archiving.id, false)}
      />
    </div>
  );
}
