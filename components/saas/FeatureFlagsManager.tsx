"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Flag = {
  id: string; key: string; enabled: boolean;
  planId: string | null; organizationId: string | null; propertyId: string | null;
  country: string | null; percentage: number | null; isBeta: boolean;
};
type Opt = { id: string; label: string };

export default function FeatureFlagsManager({ plans = [], orgs = [] }: { plans?: Opt[]; orgs?: Opt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [isBeta, setIsBeta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<Flag | null>(null);

  const load = async () => {
    const res = await fetch("/api/saas/feature-flags");
    if (res.ok) { const d = await res.json(); setFlags(d.flags); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/saas/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: form.key, enabled,
          planId: form.planId || null, organizationId: form.organizationId || null,
          propertyId: form.propertyId || null, country: form.country || null,
          percentage: form.percentage ? Number(form.percentage) : null, isBeta,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Create failed"); return; }
      setOpen(false); setForm({}); setEnabled(true); setIsBeta(false);
      toast.success("Flag created");
      load(); router.refresh();
    } finally {
      setBusy(false);
    }
  };

  /** Semantic ON/OFF — a real mutation via PATCH, never a fake state. */
  const toggle = async (flag: Flag) => {
    const res = await fetch(`/api/saas/feature-flags/${flag.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Toggle failed"); return; }
    toast.success(`${flag.key} ${!flag.enabled ? "ON" : "OFF"}`);
    load(); router.refresh();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/saas/feature-flags/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Delete failed"); return; }
    setDeleting(null);
    toast.success("Flag deleted");
    load(); router.refresh();
  };

  const scopeLabel = (f: Flag) =>
    [
      f.planId && `plan: ${plans.find((p) => p.id === f.planId)?.label ?? f.planId.slice(0, 8)}`,
      f.organizationId && `org: ${orgs.find((o) => o.id === f.organizationId)?.label ?? f.organizationId.slice(0, 8)}`,
      f.propertyId && `property: ${f.propertyId.slice(0, 8)}`,
      f.country && `country: ${f.country}`,
    ].filter(Boolean).join(" · ") || "global";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Feature Flags</h3>
        <button onClick={() => setOpen(true)} className={btnPrimary}>+ New Flag</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800"><th className="px-3 py-2">Key</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Rollout</th><th className="px-3 py-2">Beta</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="px-3 py-2 font-mono text-xs">{f.key}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggle(f)}
                    aria-pressed={f.enabled}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                      f.enabled
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400"
                    }`}
                    title={f.enabled ? "Click to turn OFF" : "Click to turn ON"}
                  >
                    <span className={`h-2 w-2 rounded-full ${f.enabled ? "bg-emerald-500" : "bg-zinc-400"}`} />
                    {f.enabled ? "ON" : "OFF"}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs">{scopeLabel(f)}</td>
                <td className="px-3 py-2 tabular-nums">{f.percentage ?? "—"}{f.percentage != null ? "%" : ""}</td>
                <td className="px-3 py-2">{f.isBeta ? "beta" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setDeleting(f)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">Delete</button>
                </td>
              </tr>
            ))}
            {flags.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-400">No flags yet. Create one to override plan entitlements.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Feature Flag">
        <div className="space-y-3">
          <Field label="Key" required><input className={inputCls} value={form.key ?? ""} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="ai_assistant, whatsapp, api_access" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled at creation</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan scope">
              <select className={inputCls} value={form.planId ?? ""} onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}>
                <option value="">— any plan —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Organization scope">
              <select className={inputCls} value={form.organizationId ?? ""} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}>
                <option value="">— any org —</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Property ID (optional)"><input className={inputCls} value={form.propertyId ?? ""} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))} /></Field>
            <Field label="Country ISO2"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Percentage rollout 0–100"><input className={inputCls} type="number" min="0" max="100" value={form.percentage ?? ""} onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={isBeta} onChange={(e) => setIsBeta(e.target.checked)} /> Beta</label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy || !form.key} onClick={create}>{busy ? "Creating…" : "Create"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        action={deleting
          ? {
              title: "Delete feature flag",
              message: `Delete "${deleting.key}"?`,
              consequences: [
                `The flag currently evaluates to ${deleting.enabled ? "ON" : "OFF"}.`,
                "Entitlement checks fall back to the plan's built-in features immediately.",
                "The deletion is recorded on the audit log under your account.",
              ],
              confirmLabel: "Delete flag",
              tone: "danger",
            }
          : null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting.id)}
      />
    </div>
  );
}
