"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";

type Territory = {
  id: string; name: string; country: string; region?: string | null; city?: string | null;
  type: string; status: string; exclusive: boolean;
  franchisee?: { company: string } | null;
  _count?: { organizations: number; children: number };
};
type Franchisee = {
  id: string; company: string; contactName: string; email: string; country?: string | null;
  revenueShareBps: number; status: string;
  territories?: { id: string; name: string; type: string; _count?: { organizations: number } }[];
};

export default function FranchiseManager({ initialTerritories, initialFranchisees, canManage }: {
  initialTerritories: Territory[];
  initialFranchisees: Franchisee[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [territories, setTerritories] = useState(initialTerritories);
  const [franchisees, setFranchisees] = useState(initialFranchisees);
  const [newT, setNewT] = useState(false);
  const [newF, setNewF] = useState(false);
  const [tf, setTf] = useState<Record<string, string>>({ country: "", type: "city", exclusive: "" });
  const [ff, setFf] = useState<Record<string, string>>({ revenueShareBps: "1500" });
  const [error, setError] = useState("");
  const tset = (k: string) => (e: { target: { value: string } }) => setTf((f) => ({ ...f, [k]: e.target.value }));
  const fset = (k: string) => (e: { target: { value: string } }) => setFf((f) => ({ ...f, [k]: e.target.value }));

  const refreshTerritories = async () => {
    const res = await fetch("/api/saas/franchise/territories");
    if (res.ok) { const d = await res.json(); setTerritories(d.territories); router.refresh(); }
  };

  const refreshFranchisees = async () => {
    const res = await fetch("/api/saas/franchise/franchisees");
    if (res.ok) { const d = await res.json(); setFranchisees(d.franchisees ?? []); router.refresh(); }
  };

  const createTerritory = async () => {
    setError("");
    const res = await fetch("/api/saas/franchise/territories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tf.name, country: tf.country, region: tf.region || undefined, city: tf.city || undefined, type: tf.type, exclusive: tf.exclusive === "on", franchiseeId: tf.franchiseeId || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Create failed"); return; }
    setNewT(false); setTf({ country: "", type: "city", exclusive: "" }); refreshTerritories();
  };

  const createFranchisee = async () => {
    setError("");
    const res = await fetch("/api/saas/franchise/franchisees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ff, revenueShareBps: Number(ff.revenueShareBps) }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Create failed"); return; }
    setNewF(false); setFf({ revenueShareBps: "1500" }); refreshFranchisees();
  };

  const fStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/franchise/franchisees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Update failed"); return; }
    refreshFranchisees();
  };

  const tStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/franchise/territories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { alert("Update failed"); return; }
    refreshTerritories();
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setNewF(true)}>+ Franchisee</button>
          <button className={btnPrimary} onClick={() => setNewT(true)}>+ Territory</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">Territory</th><th className="px-3 py-2">Geo (C/R/C)</th><th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Franchisee</th><th className="px-3 py-2">Customers</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {territories.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2 font-medium">{t.name}{t.exclusive && <span className="ml-1 text-xs text-amber-600" title="exclusive">★</span>}</td>
                <td className="px-3 py-2 text-xs">{[t.country, t.region, t.city].filter(Boolean).join(" / ")}</td>
                <td className="px-3 py-2 text-xs">{t.type}</td>
                <td className="px-3 py-2 text-xs">{t.franchisee?.company ?? "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{t._count?.organizations ?? 0}</td>
                <td className="px-3 py-2"><Badge>{t.status}</Badge></td>
                <td className="px-3 py-2">{canManage && (
                  <button onClick={() => tStatus(t.id, t.status === "active" ? "inactive" : "active")} className={btnGhost}>
                    {t.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                )}</td>
              </tr>
            ))}
            {territories.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No territories yet</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">Franchisee</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Share</th>
            <th className="px-3 py-2">Territories</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th>
          </tr></thead>
          <tbody>
            {franchisees.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2"><span className="font-medium">{f.company}</span><span className="block text-xs text-zinc-500">{f.contactName} · {f.email}</span></td>
                <td className="px-3 py-2 text-xs">{f.country ?? "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{(f.revenueShareBps / 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-xs">{f.territories?.length ?? 0}</td>
                <td className="px-3 py-2"><Badge>{f.status}</Badge></td>
                <td className="px-3 py-2 space-x-1">
                  {canManage && f.status === "proposed" && <button onClick={() => fStatus(f.id, "signed")} className={btnGhost}>Sign</button>}
                  {canManage && f.status === "signed" && <button onClick={() => fStatus(f.id, "active")} className={btnGhost}>Activate</button>}
                  {canManage && ["signed", "active"].includes(f.status) && <button onClick={() => fStatus(f.id, "terminated")} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600">Terminate</button>}
                </td>
              </tr>
            ))}
            {franchisees.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-400">No franchisees yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={newT} onClose={() => setNewT(false)} title="New Territory">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required><input className={inputCls} value={tf.name ?? ""} onChange={tset("name")} /></Field>
            <Field label="Country (ISO2)" required><input className={inputCls} maxLength={2} value={tf.country ?? ""} onChange={tset("country")} /></Field>
            <Field label="Region"><input className={inputCls} value={tf.region ?? ""} onChange={tset("region")} /></Field>
            <Field label="City"><input className={inputCls} value={tf.city ?? ""} onChange={tset("city")} /></Field>
            <Field label="Type"><select className={inputCls} value={tf.type} onChange={tset("type")}><option value="master">master (country)</option><option value="region">region</option><option value="city">city</option></select></Field>
            <Field label="Franchisee"><select className={inputCls} value={tf.franchiseeId ?? ""} onChange={tset("franchiseeId")}><option value="">— none —</option>{franchisees.filter((f) => ["signed", "active"].includes(f.status)).map((f) => <option key={f.id} value={f.id}>{f.company}</option>)}</select></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tf.exclusive === "on"} onChange={(e) => setTf((f) => ({ ...f, exclusive: e.target.checked ? "on" : "" }))} /> Exclusive (blocks overlaps)</label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setNewT(false)}>Cancel</button>
            <button className={btnPrimary} disabled={!tf.name || !tf.country} onClick={createTerritory}>Create</button>
          </div>
        </div>
      </Modal>

      <Modal open={newF} onClose={() => setNewF(false)} title="New Franchisee">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company" required><input className={inputCls} value={ff.company ?? ""} onChange={fset("company")} /></Field>
            <Field label="Contact name" required><input className={inputCls} value={ff.contactName ?? ""} onChange={fset("contactName")} /></Field>
            <Field label="Email" required><input className={inputCls} type="email" value={ff.email ?? ""} onChange={fset("email")} /></Field>
            <Field label="Phone"><input className={inputCls} value={ff.phone ?? ""} onChange={fset("phone")} /></Field>
            <Field label="Country"><input className={inputCls} maxLength={2} value={ff.country ?? ""} onChange={fset("country")} /></Field>
            <Field label="Revenue share (bps)"><input className={inputCls} type="number" value={ff.revenueShareBps ?? ""} onChange={fset("revenueShareBps")} /></Field>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setNewF(false)}>Cancel</button>
            <button className={btnPrimary} disabled={!ff.company || !ff.contactName || !ff.email} onClick={createFranchisee}>Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
