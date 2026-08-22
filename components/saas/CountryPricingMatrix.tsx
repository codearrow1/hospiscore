"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";

export interface PriceRow {
  id: string;
  country: string;
  currency: string;
  monthly: number;
  annual: number;
  planId: string;
  plan: { id: string; name: string; slug: string; isActive: boolean; archivedAt?: string | null; isCustomPrice: boolean };
}

type CountryOpt = { code: string; name: string; currency: string };

const COUNTRY_NAMES = new Map<string, string>();

/**
 * Global pricing catalog (SaaS Super Admin view): every active plan × every
 * configured market, in the market's own currency. Editing a cell flows
 * through PATCH /api/saas/plans/:id → canonical applier → Marketing
 * PricingDoc mirror + US billing invariant.
 */
export default function CountryPricingMatrix({ initialPrices, countries, canEdit }: {
  initialPrices: PriceRow[];
  countries: CountryOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialPrices);
  const [planFilter, setPlanFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  for (const c of countries) COUNTRY_NAMES.set(c.code, c.name);

  const planOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const r of rows) if (!seen.has(r.planId)) seen.set(r.planId, { id: r.planId, name: r.plan.name });
    return [...seen.values()];
  }, [rows]);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (planFilter && r.planId !== planFilter) return false;
        if (countryFilter && r.country !== countryFilter) return false;
        if (currencyFilter && r.currency !== currencyFilter) return false;
        const active = r.plan.isActive && !r.plan.archivedAt;
        if (statusFilter === "active" && !active) return false;
        if (statusFilter === "archived" && active) return false;
        return true;
      }),
    [rows, planFilter, countryFilter, currencyFilter, statusFilter],
  );

  const refresh = async () => {
    const res = await fetch("/api/saas/plan-prices");
    if (res.ok) {
      const d = await res.json();
      setRows(d.prices);
      router.refresh();
    }
  };

  const selectCls = `${inputCls} py-1.5 text-xs`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Country / Market</label>
          <select className={selectCls} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            <option value="">All Countries</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Currency</label>
          <select className={selectCls} value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
            <option value="">All Currencies</option>
            {[...new Set(countries.map((c) => c.currency))].sort().map((cur) => <option key={cur} value={cur}>{cur}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Plan</label>
          <select className={selectCls} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="">All Plans</option>
            {planOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Status</label>
          <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <span className="ml-auto text-xs text-zinc-500">{visible.length} price rows</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="max-h-[480px] overflow-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white dark:bg-zinc-900">
            <tr className="text-xs uppercase text-zinc-400">
              <th className="px-3 py-2">Plan</th><th className="px-3 py-2">Country / Market</th><th className="px-3 py-2">Currency</th>
              <th className="px-3 py-2">Monthly</th><th className="px-3 py-2">Annual</th><th className="px-3 py-2">Status</th>
              {canEdit && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={`border-t ${!r.plan.isActive || r.plan.archivedAt ? "opacity-50" : ""}`}>
                <td className="px-3 py-1.5 font-medium">
                  {r.plan.name}
                  {r.plan.isCustomPrice ? <span className="ml-1 rounded bg-zinc-200 px-1 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">CUSTOM</span> : null}
                </td>
                <td className="px-3 py-1.5">{COUNTRY_NAMES.get(r.country) ?? r.country} <span className="font-mono text-xs text-zinc-500">{r.country}</span></td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.currency}</td>
                <td className="px-3 py-1.5 tabular-nums">{r.monthly.toLocaleString()}</td>
                <td className="px-3 py-1.5 tabular-nums">{r.annual.toLocaleString()}</td>
                <td className="px-3 py-1.5">{r.plan.isActive && !r.plan.archivedAt ? <Badge>Active</Badge> : <Badge>Off</Badge>}</td>
                {canEdit && (
                  <td className="px-3 py-1.5">
                    <button onClick={() => { setError(""); setEditing(r); }} className={btnGhost}>Edit</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <PriceEditModal
          row={editing}
          onClose={() => { setEditing(null); setError(""); }}
          onSaved={() => { setEditing(null); refresh(); }}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      )}
    </div>
  );
}

function PriceEditModal({ row, onClose, onSaved, busy, setBusy, setError }: {
  row: PriceRow;
  onClose: () => void;
  onSaved: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (s: string) => void;
}) {
  const [monthly, setMonthly] = useState(String(row.monthly));
  const [annual, setAnnual] = useState(String(row.annual));
  const market = row.currency === "USD";

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/saas/plans/${row.planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryPrices: [{ country: row.country, currency: row.currency, monthly: Number(monthly), annual: Number(annual) }],
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Save failed"); return; }
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`${row.plan.name} — ${row.country}`}>
      <div className="space-y-3">
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          Saving syncs automatically: canonical price row {market ? "+ US billing baseline (units ×100)" : ""} → Marketing storefront pricing for this market.
          Amounts are in <strong>{row.currency}</strong> units (not cents).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Monthly (${row.currency})`}><input className={inputCls} type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field>
          <Field label={`Annual (${row.currency})`}><input className={inputCls} type="number" min="0" value={annual} onChange={(e) => setAnnual(e.target.value)} /></Field>
        </div>
        {row.plan.isCustomPrice && (
          <p className="text-xs text-amber-600 dark:text-amber-400">This is a contact-sales plan — numeric values here are informational only.</p>
        )}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save & Sync"}</button>
        </div>
      </div>
    </Modal>
  );
}
