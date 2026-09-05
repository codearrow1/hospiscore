"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";

type Flag = { id: string; key: string; enabled: boolean; planId: string|null; organizationId: string|null; propertyId: string|null; country: string|null; percentage: number|null; isBeta: boolean };

export default function FeatureFlagsManager() {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [isBeta, setIsBeta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/saas/feature-flags");
    if (res.ok) { const d = await res.json(); setFlags(d.flags); }
  };
  useEffect(()=>{ load(); },[]);

  const create = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/saas/feature-flags", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ key: form.key, enabled, planId: form.planId||null, organizationId: form.organizationId||null, propertyId: form.propertyId||null, country: form.country||null, percentage: form.percentage?Number(form.percentage):null, isBeta })});
      const d = await res.json().catch(()=>({}));
      if(!res.ok){ setError(d.error??"Create failed"); return; }
      setOpen(false); setForm({}); load(); router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Feature Flags (Plan / Org / Property / Country / % rollout)</h3>
        <button onClick={()=>setOpen(true)} className={btnPrimary}>+ New Flag</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400"><th className="px-2 py-1">Key</th><th className="px-2 py-1">Enabled</th><th className="px-2 py-1">Scope</th><th className="px-2 py-1">%</th><th className="px-2 py-1">Beta</th></tr></thead>
          <tbody>
            {flags.map((f)=><tr key={f.id} className="border-t"><td className="px-2 py-1 font-mono text-xs">{f.key}</td><td className="px-2 py-1">{f.enabled?<Badge>ON</Badge>:<Badge>OFF</Badge>}</td><td className="px-2 py-1 text-xs">{[f.planId&&`plan:${f.planId.slice(0,6)}`, f.organizationId&&`org:${f.organizationId.slice(0,6)}`, f.propertyId&&`prop:${f.propertyId.slice(0,6)}`, f.country&&`country:${f.country}`].filter(Boolean).join(" · ") || "global"}</td><td className="px-2 py-1">{f.percentage ?? "—"}</td><td className="px-2 py-1">{f.isBeta?"yes":"—"}</td></tr>)}
            {flags.length===0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-zinc-500">No flags yet. Create one to override plan entitlements.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title="New Feature Flag">
        <div className="space-y-3">
          <Field label="Key" required><input className={inputCls} value={form.key??""} onChange={(e)=>setForm(f=>({...f,key:e.target.value}))} placeholder="ai_assistant, whatsapp, api_access" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} /> Enabled</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan ID (optional)"><input className={inputCls} value={form.planId??""} onChange={(e)=>setForm(f=>({...f,planId:e.target.value}))} /></Field>
            <Field label="Organization ID"><input className={inputCls} value={form.organizationId??""} onChange={(e)=>setForm(f=>({...f,organizationId:e.target.value}))} /></Field>
            <Field label="Property ID"><input className={inputCls} value={form.propertyId??""} onChange={(e)=>setForm(f=>({...f,propertyId:e.target.value}))} /></Field>
            <Field label="Country ISO2"><input className={inputCls} maxLength={2} value={form.country??""} onChange={(e)=>setForm(f=>({...f,country:e.target.value}))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Percentage 0-100 (rollout)"><input className={inputCls} type="number" value={form.percentage??""} onChange={(e)=>setForm(f=>({...f,percentage:e.target.value}))} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isBeta} onChange={(e)=>setIsBeta(e.target.checked)} /> Beta</label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={()=>setOpen(false)}>Cancel</button><button className={btnPrimary} disabled={busy||!form.key} onClick={create}>{busy?"Creating…":"Create"}</button></div>
        </div>
      </Modal>
      <p className="text-xs text-zinc-500">Evaluation order: property → organization → plan → country → global → plan.features fallback. Percentage uses hash(orgId+key) bucket. Central check: <code>hasEntitlement(orgId, feature)</code> via <code>lib/saas/entitlements.ts:14</code> — never scatter <code>plan===&apos;enterprise&apos;</code>.</p>
    </div>
  );
}
