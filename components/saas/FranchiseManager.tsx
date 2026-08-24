"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Territory = {
  id: string; name: string; country: string; region?: string | null; city?: string | null;
  type: string; status: string; exclusive: boolean;
  parentTerritoryId?: string | null;
  franchisee?: { company: string } | null;
  _count?: { organizations: number; children: number };
};
type Franchisee = {
  id: string; company: string; contactName: string; email: string; country?: string | null;
  revenueShareBps: number; status: string;
  territories?: { id: string; name: string; type: string; _count?: { organizations: number } }[];
};

const TYPE_INDENT: Record<string, string> = { master: "", region: "│  ", city: "│    " };

export default function FranchiseManager({ initialTerritories, initialFranchisees, canManage, territoryMrr = {} }: {
  initialTerritories: Territory[];
  initialFranchisees: Franchisee[];
  canManage: boolean;
  /** cents/month per territoryId (active-ish subs) */
  territoryMrr?: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [territories, setTerritories] = useState(initialTerritories);
  const [franchisees, setFranchisees] = useState(initialFranchisees);
  const [newT, setNewT] = useState(false);
  const [newF, setNewF] = useState(false);
  const [terminating, setTerminating] = useState<Franchisee | null>(null);
  const [deactivatingT, setDeactivatingT] = useState<Territory | null>(null);
  const [tf, setTf] = useState<Record<string, string>>({ country: "", type: "city", exclusive: "" });
  const [ff, setFf] = useState<Record<string, string>>({ revenueShareBps: "1500" });
  // Simulator state
  const [simFid, setSimFid] = useState("");
  const [simBps, setSimBps] = useState("1500");
  const [error, setError] = useState("");
  const tset = (k: string) => (e: { target: { value: string } }) => setTf((f) => ({ ...f, [k]: e.target.value }));
  const fset = (k: string) => (e: { target: { value: string } }) => setFf((f) => ({ ...f, [k]: e.target.value }));

  /** Hierarchy-aware ordering: masters first, then their descendants, indented by depth. */
  const orderedTerritories = useMemo(() => {
    const byParent = new Map<string | null, Territory[]>();
    for (const t of [...territories].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = t.parentTerritoryId && territories.some((x) => x.id === t.parentTerritoryId) ? t.parentTerritoryId : null;
      const list = byParent.get(key) ?? [];
      list.push(t);
      byParent.set(key, list);
    }
    const out: { t: Territory; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const t of byParent.get(parent) ?? []) {
        out.push({ t, depth });
        walk(t.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [territories]);

  /** Simulator: share = bps × Σ MRR of the franchisee's active territories. */
  const sim = useMemo(() => {
    const fid = simFid;
    const bps = Math.max(0, Math.min(5000, Number(simBps) || 0));
    if (!fid) return null;
    // Franchisee's territory ids come from the embedded territories relation.
    const f = franchisees.find((x) => x.id === fid);
    const ids = new Set((f?.territories ?? []).map((t) => t.id));
    let mrrCents = 0;
    for (const id of ids) mrrCents += territoryMrr[id] ?? 0;
    return {
      company: f?.company ?? "",
      contractedBps: f?.revenueShareBps ?? 0,
      simBps: bps,
      mrrCents,
      shareCents: Math.round((mrrCents * bps) / 10000),
      currentShareCents: Math.round((mrrCents * (f?.revenueShareBps ?? 0)) / 10000),
      territoryCount: ids.size,
    };
  }, [simFid, simBps, franchisees, territoryMrr]);

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
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Update failed"); return; }
    setTerminating(null);
    refreshFranchisees();
  };

  const tStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/franchise/territories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { toast.error("Update failed"); return; }
    setDeactivatingT(null);
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
            <th className="px-3 py-2">Territory</th><th className="px-3 py-2">Geo (C/R/C)</th>
            <th className="px-3 py-2">Franchisee</th><th className="px-3 py-2">Customers</th><th className="px-3 py-2">MRR</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {orderedTerritories.map(({ t, depth }) => (
              <tr key={t.id} className={`border-t ${t.status === "inactive" ? "opacity-60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  <span className="mr-1 text-zinc-300 dark:text-zinc-600">{TYPE_INDENT[t.type] ?? "│    "}</span>
                  {depth > 0 && <span className="mr-1 text-zinc-300 dark:text-zinc-600">└</span>}
                  {t.name}
                  <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{t.type}</span>
                  {t.exclusive && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" title="Exclusive — blocks overlapping territories">EXCLUSIVE</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{[t.country, t.region, t.city].filter(Boolean).join(" / ")}</td>
                <td className="px-3 py-2 text-xs">{t.franchisee?.company ?? "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{t._count?.organizations ?? 0}</td>
                <td className="px-3 py-2 text-xs tabular-nums">${((territoryMrr[t.id] ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-3 py-2"><Badge>{t.status}</Badge></td>
                <td className="px-3 py-2">{canManage && (
                  t.status === "active"
                    ? <button onClick={() => setDeactivatingT(t)} className={btnGhost}>Deactivate</button>
                    : <button onClick={() => tStatus(t.id, "active")} className={btnGhost}>Activate</button>
                )}</td>
              </tr>
            ))}
            {territories.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No territories yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Revenue-share simulator — client-side estimate, no server mutation */}
      <div className="rounded-2xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Revenue-share simulator</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Estimate a franchisee&apos;s monthly share from live territory MRR. Estimates only — invoicing is not automated yet.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56">
            <Field label="Franchisee">
              <select className={inputCls} value={simFid} onChange={(e) => { setSimFid(e.target.value); const f = franchisees.find((x) => x.id === e.target.value); if (f) setSimBps(String(f.revenueShareBps)); }}>
                <option value="">— select —</option>
                {franchisees.map((f) => <option key={f.id} value={f.id}>{f.company}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-40">
            <Field label="Share (bps)">
              <input className={inputCls} type="number" min={0} max={5000} value={simBps} onChange={(e) => setSimBps(e.target.value)} />
            </Field>
          </div>
          {sim && (
            <dl className="ml-auto grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
              <div><dt className="text-[11px] uppercase tracking-wide text-zinc-400">Territory MRR</dt><dd className="font-semibold tabular-nums">${(sim.mrrCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-zinc-400">Contracted ({(sim.contractedBps / 100).toFixed(1)}%)</dt><dd className="font-semibold tabular-nums">${(sim.currentShareCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-zinc-400">Simulated ({(sim.simBps / 100).toFixed(1)}%)</dt><dd className={`font-semibold tabular-nums ${sim.simBps !== sim.contractedBps ? "text-blue-600 dark:text-blue-400" : ""}`}>${(sim.shareCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-zinc-400">Δ vs contract</dt><dd className={`font-semibold tabular-nums ${(sim.shareCents - sim.currentShareCents) > 0 ? "text-emerald-600 dark:text-emerald-400" : (sim.shareCents - sim.currentShareCents) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {(sim.shareCents - sim.currentShareCents >= 0 ? "+" : "") + `$${((sim.shareCents - sim.currentShareCents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </dd></div>
            </dl>
          )}
        </div>
      </div>

      {/* Planned capabilities — visibly separated so nothing reads as shipped */}
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Planned capabilities — not yet available</h3>
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          <li>Auto-routing of new signups into the correct exclusive territory</li>
          <li>Automated monthly royalty invoicing from realized revenue share</li>
          <li>Franchisee portal access with scoped territory dashboards</li>
        </ul>
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
                  {canManage && ["signed", "active"].includes(f.status) && <button onClick={() => setTerminating(f)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600">Terminate</button>}
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

      <ConfirmDialog
        action={terminating
          ? {
              title: "Terminate franchisee",
              message: `Terminate "${terminating.company}"?`,
              consequences: [
                "The franchisee loses access to their assigned territories.",
                "Existing revenue-share obligations remain on record.",
                "This status is permanent — create a new franchisee to re-contract.",
              ],
              confirmLabel: "Terminate",
              tone: "danger",
            }
          : null}
        onClose={() => setTerminating(null)}
        onConfirm={() => terminating && fStatus(terminating.id, "terminated")}
      />

      <ConfirmDialog
        action={deactivatingT
          ? {
              title: "Deactivate territory",
              message: `Deactivate "${deactivatingT.name}"?`,
              consequences: [
                "New organizations can no longer be routed into this territory.",
                "Existing customers in the territory are unaffected.",
                "You can reactivate it later from this list.",
              ],
              confirmLabel: "Deactivate",
              tone: "warning",
            }
          : null}
        onClose={() => setDeactivatingT(null)}
        onConfirm={() => deactivatingT && tStatus(deactivatingT.id, "inactive")}
      />
    </div>
  );
}
