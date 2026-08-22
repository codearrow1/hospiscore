"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";

type Sub = {
  id: string;
  organization: { legalName: string };
  plan: { id: string; name: string };
  billingCycle: string;
  status: string;
  mrr: number;
  country: string;
  currency: string;
  unitAmount: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

type OrgOpt = { id: string; legalName: string; country?: string | null };
type PlanOpt = { id: string; name: string; slug: string; isCustomPrice?: boolean; isActive?: boolean };
type CountryOpt = { code: string; name: string; currency: string };

const STATUSES = ["trial", "active", "past_due", "grace", "suspended", "cancelled", "expired", "paused"] as const;

const COUNTRY_NAMES = new Map<string, string>();

/** Authoritative charged-amount display. Legacy USD rows (unitAmount null)
 * keep their historical cents-based MRR snapshot; newer rows show their own
 * market currency at face value — never converted or re-labelled. */
function amountLabel(s: Sub): string {
  if (s.unitAmount !== null && s.unitAmount !== undefined) return `${s.unitAmount.toLocaleString()} ${s.currency}`;
  if (s.currency === "USD") return `$${(s.mrr / 100).toFixed(2)} USD`;
  return `— ${s.currency}`;
}

export default function SubscriptionsManager({ initialSubs, orgs, plans, countries }: {
  initialSubs: Sub[];
  orgs: OrgOpt[];
  plans: PlanOpt[];
  countries: CountryOpt[];
}) {
  const router = useRouter();
  const [subs, setSubs] = useState(initialSubs);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [fCurrency, setFCurrency] = useState("");
  const [fPlan, setFPlan] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCycle, setFCycle] = useState("");

  for (const c of countries) COUNTRY_NAMES.set(c.code, c.name);

  const visible = useMemo(
    () =>
      subs.filter((s) => {
        if (fCountry && s.country !== fCountry) return false;
        if (fCurrency && s.currency !== fCurrency) return false;
        if (fPlan && s.plan.id !== fPlan) return false;
        if (fStatus && s.status !== fStatus) return false;
        if (fCycle && s.billingCycle !== fCycle) return false;
        return true;
      }),
    [subs, fCountry, fCurrency, fPlan, fStatus, fCycle],
  );

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
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Transition failed");
      return;
    }
    refresh();
  };

  const selectCls = `${inputCls} py-1.5 text-xs`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Country</label>
            <select className={selectCls} value={fCountry} onChange={(e) => setFCountry(e.target.value)}>
              <option value="">All Countries</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Currency</label>
            <select className={selectCls} value={fCurrency} onChange={(e) => setFCurrency(e.target.value)}>
              <option value="">All Currencies</option>
              {[...new Set(countries.map((c) => c.currency))].sort().map((cur) => <option key={cur} value={cur}>{cur}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Plan</label>
            <select className={selectCls} value={fPlan} onChange={(e) => setFPlan(e.target.value)}>
              <option value="">All Plans</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Status</label>
            <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Interval</label>
            <select className={selectCls} value={fCycle} onChange={(e) => setFCycle(e.target.value)}>
              <option value="">Both</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </div>
        </div>
        <button onClick={() => setCreating(true)} className={btnPrimary}>+ New Subscription</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400"><th className="px-3 py-2">Org</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Charged</th><th className="px-3 py-2">Cycle</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.organization.legalName}</td>
                <td className="px-3 py-2">{s.plan.name}</td>
                <td className="px-3 py-2">{COUNTRY_NAMES.get(s.country) ?? s.country} <span className={`ml-1 rounded px-1 font-mono text-[10px] ${s.country === "US" ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>{s.country}</span></td>
                <td className="px-3 py-2 tabular-nums">{amountLabel(s)}</td>
                <td className="px-3 py-2">{s.billingCycle}</td>
                <td className="px-3 py-2"><Badge>{s.status}</Badge></td>
                <td className="px-3 py-2 text-xs">{new Date(s.currentPeriodStart).toLocaleDateString()} → {new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <select onChange={(e) => e.target.value && transition(s.id, e.target.value)} defaultValue="" className="rounded border px-1 py-0.5 text-xs">
                    <option value="">Move to…</option>
                    {STATUSES.filter((st) => st !== s.status).map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateModal orgs={orgs} plans={plans.filter((p) => p.isActive !== false)} countries={countries} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} busy={busy} setBusy={setBusy} error={error} setError={setError} />
      )}
    </div>
  );
}

function CreateModal({ orgs, plans, countries, onClose, onCreated, busy, setBusy, error, setError }: {
  orgs: OrgOpt[];
  plans: PlanOpt[];
  countries: CountryOpt[];
  onClose: () => void;
  onCreated: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  error: string;
  setError: (s: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({ billingCycle: "monthly", status: "trial", country: "", priceOverride: "" });
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedCountry = countries.find((c) => c.code === form.country);
  const currency = selectedCountry?.currency ?? "";
  const selectedPlan = plans.find((p) => p.id === form.planId);

  // Live price preview: resolve the canonical market price for plan+country.
  const [preview, setPreview] = useState<{ monthly: number | null; annual: number | null; custom: boolean } | null>(null);
  const lookupPrice = async (planId: string, code: string) => {
    setPreview(null);
    if (!planId || !code) return;
    const res = await fetch(`/api/saas/plan-prices?planId=${encodeURIComponent(planId)}&country=${code}`);
    if (!res.ok) return;
    const d = await res.json();
    const row = d.prices?.[0];
    if (row) setPreview({ monthly: row.monthly, annual: row.annual, custom: row.plan.isCustomPrice });
  };

  const onOrgChange = (orgId: string) => {
    const org = orgs.find((o) => o.id === orgId);
    const known = org?.country && countries.some((c) => c.code === org.country) ? org.country : "";
    setForm((f) => ({ ...f, organizationId: orgId, country: known }));
    if (known && form.planId) void lookupPrice(form.planId, known);
  };

  const onCountryChange = (code: string) => {
    setForm((f) => ({ ...f, country: code }));
    void lookupPrice(form.planId ?? "", code);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = {
      organizationId: form.organizationId,
      planId: form.planId,
      billingCycle: form.billingCycle,
      status: form.status,
      startAt: form.startAt || undefined,
      unitAmount: form.priceOverride ? Number(form.priceOverride) : undefined,
    };
    if (form.country) body.country = form.country;
    else delete body.country;
    const res = await fetch("/api/saas/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Create failed"); return; }
    onCreated();
  };

  const cycleAmount = preview ? (form.billingCycle === "yearly" ? preview.annual : preview.monthly) : null;

  return (
    <Modal open onClose={onClose} title="New Subscription — Global / Multi-Currency" wide>
      <div className="space-y-3">
        <Field label="Customer / Organization" required>
          <select className={inputCls} value={form.organizationId ?? ""} onChange={(e) => onOrgChange(e.target.value)}>
            <option value="">Select org</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.legalName}{o.country ? ` (${o.country})` : ""}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Plan" required>
            <select className={inputCls} value={form.planId ?? ""} onChange={(e) => { setForm((f) => ({ ...f, planId: e.target.value })); if (form.country) void lookupPrice(e.target.value, form.country); }}>
              <option value="">Select plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Country / Market" required>
            <select className={inputCls} value={form.country} onChange={(e) => onCountryChange(e.target.value)}>
              <option value="">Select market…</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Currency"><input className={`${inputCls} opacity-70`} value={currency} readOnly placeholder="—" /></Field>
          <Field label="Billing Interval">
            <select className={inputCls} value={form.billingCycle} onChange={(e) => set("billingCycle")(e)}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Start Date"><input className={inputCls} type="date" value={form.startAt ?? ""} onChange={set("startAt")} /></Field>
          <Field label={`Price${currency ? ` (${currency})` : ""}`}>
            <input
              className={inputCls}
              type="number"
              min="0"
              placeholder={cycleAmount != null ? String(cycleAmount) : selectedPlan?.isCustomPrice ? "negotiated" : ""}
              value={form.priceOverride}
              onChange={set("priceOverride")}
            />
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={set("status")}>
              {STATUSES.slice(0, 4).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="flex items-end pb-1 text-xs text-zinc-500">
            {cycleAmount != null && !form.priceOverride ? (
              <span>Resolves to <strong>{cycleAmount.toLocaleString()} {currency}</strong>/period from the {selectedCountry?.name} catalog price.</span>
            ) : form.priceOverride ? (
              <span>Using negotiated override: <strong>{Number(form.priceOverride).toLocaleString()} {currency}</strong>.</span>
            ) : selectedPlan?.isCustomPrice && currency ? (
              <span>Contact-sales plan — enter the negotiated amount in {currency}, or leave blank for custom semantics.</span>
            ) : null}
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !form.organizationId || !form.planId || !form.country} onClick={submit}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </Modal>
  );
}
