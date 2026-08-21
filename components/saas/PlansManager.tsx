"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";

type Plan = {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  maxProperties: number | null;
  maxUsers: number | null;
  maxBookings: number | null;
  storageGb: number | null;
  features: Record<string, unknown> | null;
  isActive: boolean;
};

const FEATURE_KEYS = [
  { key: "reports", label: "Advanced Reports" },
  { key: "api", label: "API Access" },
  { key: "marketing", label: "Marketing" },
  { key: "automation", label: "Automation" },
  { key: "prioritySupport", label: "Priority Support" },
];

export default function PlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const res = await fetch("/api/saas/plans");
    if (res.ok) {
      const data = await res.json();
      setPlans(data.plans);
      router.refresh();
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this plan? Fails if subscriptions exist.")) return;
    const res = await fetch(`/api/saas/plans/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Delete failed");
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className={btnPrimary}>+ New Plan</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400"><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Slug</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Trial</th><th className="px-3 py-2">Limits</th><th className="px-3 py-2">Features</th><th className="px-3 py-2">Active</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 font-semibold">{p.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.slug}</td>
                <td className="px-3 py-2">${(p.monthlyPrice/100).toFixed(2)}/mo · ${(p.annualPrice/100).toFixed(2)}/yr {p.currency}</td>
                <td className="px-3 py-2">{p.trialDays}d</td>
                <td className="px-3 py-2 text-xs">{p.maxProperties ?? "∞"} props · {p.maxUsers ?? "∞"} users · {p.maxBookings ?? "∞"} book · {p.storageGb ?? "∞"}GB</td>
                <td className="px-3 py-2 text-xs">{p.features ? Object.entries(p.features).filter(([,v])=>v).map(([k])=>k).join(", ") || "—" : "—"}</td>
                <td className="px-3 py-2">{p.isActive ? <Badge>Active</Badge> : <Badge>Off</Badge>}</td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={() => setEditing(p)} className={btnGhost}>Edit</button>
                  <button onClick={() => del(p.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
        <h3 className="text-sm font-bold">Feature Matrix</h3>
        <table className="mt-2 w-full text-left text-xs">
          <thead><tr className="text-zinc-400"><th className="py-1">Feature</th>{plans.map((p)=><th key={p.id} className="py-1">{p.name}</th>)}</tr></thead>
          <tbody>
            {FEATURE_KEYS.map((f)=>(
              <tr key={f.key} className="border-t"><td className="py-1 font-medium">{f.label}</td>{plans.map((p)=><td key={p.id} className="py-1 text-center">{(p.features as Record<string,unknown>)?.[f.key] ? "✓" : "—"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <PlanModal
          plan={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); setError(""); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
          busy={busy}
          setBusy={setBusy}
          error={error}
          setError={setError}
        />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved, busy, setBusy, error, setError }: {
  plan?: Plan;
  onClose: () => void;
  onSaved: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  error: string;
  setError: (s: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    monthlyPrice: plan ? String(plan.monthlyPrice/100) : "",
    annualPrice: plan ? String(plan.annualPrice/100) : "",
    currency: plan?.currency ?? "USD",
    trialDays: plan ? String(plan.trialDays) : "14",
    maxProperties: plan?.maxProperties != null ? String(plan.maxProperties) : "",
    maxUsers: plan?.maxUsers != null ? String(plan.maxUsers) : "",
    maxBookings: plan?.maxBookings != null ? String(plan.maxBookings) : "",
    storageGb: plan?.storageGb != null ? String(plan.storageGb) : "",
  });
  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    const f = (plan?.features ?? {}) as Record<string, unknown>;
    const init: Record<string, boolean> = {};
    for (const k of FEATURE_KEYS) init[k.key] = Boolean(f[k.key]);
    return init;
  });
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: form.name,
      slug: form.slug,
      monthlyPrice: Math.round(Number(form.monthlyPrice) * 100),
      annualPrice: Math.round(Number(form.annualPrice) * 100),
      currency: form.currency,
      trialDays: Number(form.trialDays),
      maxProperties: form.maxProperties ? Number(form.maxProperties) : null,
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
      maxBookings: form.maxBookings ? Number(form.maxBookings) : null,
      storageGb: form.storageGb ? Number(form.storageGb) : null,
      features,
      isActive,
    };
    const url = plan ? `/api/saas/plans/${plan.id}` : "/api/saas/plans";
    const method = plan ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Save failed"); return; }
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title={plan ? `Edit ${plan.name}` : "New Plan"} wide>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" required><input className={inputCls} value={form.name} onChange={set("name")} /></Field>
        <Field label="Slug" required><input className={inputCls} value={form.slug} onChange={set("slug")} placeholder="starter" /></Field>
        <Field label="Monthly $"><input className={inputCls} type="number" step="0.01" value={form.monthlyPrice} onChange={set("monthlyPrice")} /></Field>
        <Field label="Annual $"><input className={inputCls} type="number" step="0.01" value={form.annualPrice} onChange={set("annualPrice")} /></Field>
        <Field label="Currency"><input className={inputCls} value={form.currency} onChange={set("currency")} maxLength={3} /></Field>
        <Field label="Trial Days"><input className={inputCls} type="number" value={form.trialDays} onChange={set("trialDays")} /></Field>
        <Field label="Max Properties"><input className={inputCls} type="number" value={form.maxProperties} onChange={set("maxProperties")} placeholder="blank=∞" /></Field>
        <Field label="Max Users"><input className={inputCls} type="number" value={form.maxUsers} onChange={set("maxUsers")} /></Field>
        <Field label="Max Bookings"><input className={inputCls} type="number" value={form.maxBookings} onChange={set("maxBookings")} /></Field>
        <Field label="Storage GB"><input className={inputCls} type="number" value={form.storageGb} onChange={set("storageGb")} /></Field>
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Features</p>
          <div className="flex flex-wrap gap-3">
            {FEATURE_KEYS.map((f) => (
              <label key={f.key} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!features[f.key]} onChange={(e) => setFeatures((prev) => ({ ...prev, [f.key]: e.target.checked }))} /> {f.label}</label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e)=>setIsActive(e.target.checked)} /> Active</label>
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} disabled={busy} onClick={submit}>{busy ? "Saving…" : plan ? "Save" : "Create"}</button>
      </div>
    </Modal>
  );
}
