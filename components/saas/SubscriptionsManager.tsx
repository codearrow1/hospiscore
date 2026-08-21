"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";

type Sub = {
  id: string;
  organization: { legalName: string };
  plan: { id: string; name: string };
  billingCycle: string;
  status: string;
  mrr: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

type OrgOpt = { id: string; legalName: string };
type PlanOpt = { id: string; name: string; slug: string };

const STATUSES = ["trial","active","past_due","grace","suspended","cancelled","expired","paused"] as const;

export default function SubscriptionsManager({ initialSubs, orgs, plans }: { initialSubs: Sub[]; orgs: OrgOpt[]; plans: PlanOpt[] }) {
  const router = useRouter();
  const [subs, setSubs] = useState(initialSubs);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const res = await fetch("/api/saas/subscriptions");
    if (res.ok) {
      const d = await res.json();
      setSubs(d.subscriptions);
      router.refresh();
    }
  };

  const transition = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      alert(d.error ?? "Transition failed");
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className={btnPrimary}>+ New Subscription</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400"><th className="px-3 py-2">Org</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Cycle</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">MRR</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.organization.legalName}</td>
                <td className="px-3 py-2">{s.plan.name}</td>
                <td className="px-3 py-2">{s.billingCycle}</td>
                <td className="px-3 py-2"><Badge>{s.status}</Badge></td>
                <td className="px-3 py-2">${(s.mrr/100).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs">{new Date(s.currentPeriodStart).toLocaleDateString()} → {new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <select onChange={(e)=> e.target.value && transition(s.id, e.target.value)} defaultValue="" className="rounded border px-1 py-0.5 text-xs">
                    <option value="">Move to…</option>
                    {STATUSES.filter(st=>st!==s.status).map(st=><option key={st} value={st}>{st}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <CreateModal orgs={orgs} plans={plans} onClose={()=>setCreating(false)} onCreated={()=>{setCreating(false); refresh();}} busy={busy} setBusy={setBusy} error={error} setError={setError} />}
    </div>
  );
}

function CreateModal({ orgs, plans, onClose, onCreated, busy, setBusy, error, setError }: {
  orgs: OrgOpt[]; plans: PlanOpt[]; onClose: ()=>void; onCreated: ()=>void; busy:boolean; setBusy:(b:boolean)=>void; error:string; setError:(s:string)=>void;
}) {
  const [form, setForm] = useState<Record<string,string>>({ billingCycle: "monthly", status: "trial" });
  const set = (k:string)=>(e:{target:{value:string}})=>setForm(f=>({...f,[k]:e.target.value}));
  const submit = async ()=>{
    setBusy(true); setError("");
    const res = await fetch("/api/saas/subscriptions", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ organizationId: form.organizationId, planId: form.planId, billingCycle: form.billingCycle, status: form.status })});
    const d = await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok){ setError(d.error??"Create failed"); return; }
    onCreated();
  };
  return (
    <Modal open={true} onClose={onClose} title="New Subscription">
      <div className="space-y-3">
        <Field label="Organization" required>
          <select className={inputCls} value={form.organizationId ?? ""} onChange={set("organizationId")}>
            <option value="">Select org</option>
            {orgs.map(o=><option key={o.id} value={o.id}>{o.legalName}</option>)}
          </select>
        </Field>
        <Field label="Plan" required>
          <select className={inputCls} value={form.planId ?? ""} onChange={set("planId")}>
            <option value="">Select plan</option>
            {plans.map(p=><option key={p.id} value={p.id}>{p.name} ({p.slug})</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cycle"><select className={inputCls} value={form.billingCycle} onChange={set("billingCycle")}><option value="monthly">monthly</option><option value="yearly">yearly</option></select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={set("status")}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !form.organizationId || !form.planId} onClick={submit}>{busy?"Creating…":"Create"}</button>
        </div>
      </div>
    </Modal>
  );
}
