"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "@/components/marketing-admin/ui";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";

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
type Filters = { status: string; plan: string; country: string; currency: string; cycle: string };

const STATUSES = ["trial", "active", "past_due", "grace", "suspended", "cancelled", "expired", "paused"] as const;

/** Authoritative lifecycle graph — mirrors lib/saas/subscriptions.ts. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  trial: ["active", "cancelled", "expired", "past_due"],
  active: ["past_due", "grace", "suspended", "cancelled", "paused", "expired"],
  past_due: ["grace", "suspended", "cancelled", "active"],
  grace: ["suspended", "cancelled", "active"],
  suspended: ["cancelled", "expired", "active"],
  cancelled: ["expired"],
  expired: [],
  paused: ["active", "cancelled"],
};

const STATUS_EXPLANATIONS: Record<string, string> = {
  trial: "Free evaluation window. Converts to active, or ends in cancelled/expired.",
  active: "Paying and healthy. Renews at each period boundary.",
  past_due: "Latest payment failed. Retry schedule is running (day 1/3/5/7).",
  grace: "Final courtesy window after past_due before access is cut.",
  suspended: "Access is blocked. Billing is held; data is retained.",
  cancelled: "Ended by choice or policy. Terminal unless expired transition is recorded.",
  expired: "Historical record only. No further transitions.",
  paused: "Temporary hold requested by the customer — no new invoices, resumes on reactivate.",
};

/** Per-target consequence copy so every mutation is explicit. */
const TRANSITION_COPY: Record<string, { title: string; consequences: string[]; tone: "danger" | "warning" | "primary" }> = {
  active: {
    title: "Reactivate subscription",
    tone: "primary",
    consequences: [
      "The customer regains workspace access immediately.",
      "Billing resumes on the next sweep with the existing plan and cycle.",
      "Recorded on the audit log under your account.",
    ],
  },
  past_due: {
    title: "Mark as past due",
    tone: "warning",
    consequences: [
      "Starts the dunning retry schedule (days 1, 3, 5, 7).",
      "The customer sees a payment-failed notice in their portal.",
    ],
  },
  grace: {
    title: "Move to grace period",
    tone: "warning",
    consequences: [
      "This is the last courtesy window before suspension.",
      "The customer is prompted to update their payment method.",
    ],
  },
  suspended: {
    title: "Suspend subscription",
    tone: "danger",
    consequences: [
      "The customer immediately loses access to their workspace.",
      "Billing stops generating new invoices while suspended.",
      "Data is retained; reactivation restores access without data loss.",
    ],
  },
  cancelled: {
    title: "Cancel subscription",
    tone: "danger",
    consequences: [
      "The subscription ends — this is the point of no return before expiry.",
      "The customer loses access at the end of the current period.",
      "Historical invoices and usage stay intact for reporting.",
    ],
  },
  expired: {
    title: "Expire subscription",
    tone: "danger",
    consequences: [
      "The subscription becomes a terminal historical record.",
      "No further lifecycle actions are possible after this.",
    ],
  },
  paused: {
    title: "Pause subscription",
    tone: "warning",
    consequences: [
      "No new invoices are generated while paused.",
      "The customer keeps read-only portal visibility.",
      "Resume anytime via the Reactivate action.",
    ],
  },
};

function amountLabel(s: Sub): string {
  if (s.unitAmount !== null && s.unitAmount !== undefined) return formatMoney(s.unitAmount, s.currency);
  return formatMoney(s.mrr, s.currency);
}

export default function SubscriptionsManager({ initialSubs, orgs, plans, countries, filters }: {
  initialSubs: Sub[];
  orgs: OrgOpt[];
  plans: PlanOpt[];
  countries: CountryOpt[];
  filters: Filters;
}) {
  const router = useRouter();
  const toast = useToast();
  const [subs] = useState(initialSubs);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ sub: Sub; status: string } | null>(null);
  const [renewing, setRenewing] = useState<Sub | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const COUNTRY_NAMES = useMemo(() => new Map(countries.map((c) => [c.code, c.name])), [countries]);

  /** URL-synced filter updates keep shareable views + browser back working. */
  const setFilter = (key: keyof Filters, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/saas/subscriptions${params.toString() ? `?${params}` : ""}`);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const refresh = async () => {
    router.refresh();
  };

  const transition = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Transition failed");
      return;
    }
    setPending(null);
    toast.success(`Subscription moved to ${status}`);
    refresh();
  };

  const renew = async (id: string) => {
    const res = await fetch(`/api/saas/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "renew" }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Renew failed");
      return;
    }
    setRenewing(null);
    toast.success("Subscription renewed — new invoice issued");
    refresh();
  };

  const canRenew = (s: Sub) => ["active", "past_due", "grace"].includes(s.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterSheet
          label="Filters"
          activeCount={Object.values(filters).filter(Boolean).length}
          onClearAll={() => router.replace("/saas/subscriptions")}
        >
          <Field label="Status">
            <select className={inputCls} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Plan">
            <select className={inputCls} value={filters.plan} onChange={(e) => setFilter("plan", e.target.value)}>
              <option value="">All plans</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Country">
            <select className={inputCls} value={filters.country} onChange={(e) => setFilter("country", e.target.value)}>
              <option value="">All countries</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select className={inputCls} value={filters.currency} onChange={(e) => setFilter("currency", e.target.value)}>
              <option value="">All currencies</option>
              {[...new Set(countries.map((c) => c.currency))].sort().map((cur) => <option key={cur} value={cur}>{cur}</option>)}
            </select>
          </Field>
          <Field label="Interval">
            <select className={inputCls} value={filters.cycle} onChange={(e) => setFilter("cycle", e.target.value)}>
              <option value="">Both</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </Field>
        </FilterSheet>
        {hasFilters && (
          <button onClick={() => router.replace("/saas/subscriptions")} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            Clear all
          </button>
        )}
        <button onClick={() => setCreating(true)} className={`${btnPrimary} ml-auto`}>+ New Subscription</button>
      </div>

      {subs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold">{hasFilters ? "No subscriptions match these filters" : "No subscriptions yet"}</p>
          <p className="mt-1 text-xs text-zinc-500">{hasFilters ? "Clear the filters to see the full book." : "Create one with the button above."}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {subs.map((s) => (
              <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.organization.legalName}</p>
                    <p className="truncate text-xs text-zinc-500">{s.plan.name} · {COUNTRY_NAMES.get(s.country) ?? s.country}</p>
                  </div>
                  <StatusBadge domain="subscription" status={s.status} />
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-zinc-400">Charged</dt><dd className="tabular-nums">{amountLabel(s)} / {s.billingCycle}</dd>
                  <dt className="text-zinc-400">Period</dt><dd>{new Date(s.currentPeriodStart).toLocaleDateString()} → {new Date(s.currentPeriodEnd).toLocaleDateString()}</dd>
                </dl>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                  {canRenew(s) && (
                    <button onClick={() => setRenewing(s)} className={`${btnGhost} px-2 py-1 text-xs`}>Renew</button>
                  )}
                  {(ALLOWED_TRANSITIONS[s.status] ?? []).map((target) => (
                    <button
                      key={target}
                      onClick={() => setPending({ sub: s, status: target })}
                      title={STATUS_EXPLANATIONS[target]}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      → {target}
                    </button>
                  ))}
                  {(ALLOWED_TRANSITIONS[s.status] ?? []).length === 0 && canRenew(s) === false && (
                    <span className="text-xs text-zinc-400">Terminal state — no transitions available.</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800"><th className="px-3 py-2">Org</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Market</th><th className="px-3 py-2">Charged</th><th className="px-3 py-2">Cycle</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Lifecycle</th></tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-3 py-2 font-medium">{s.organization.legalName}</td>
                  <td className="px-3 py-2">{s.plan.name}</td>
                  <td className="px-3 py-2 text-xs">{COUNTRY_NAMES.get(s.country) ?? s.country} <span className={`ml-1 rounded px-1 font-mono text-[10px] ${s.country === "US" ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>{s.country}</span></td>
                  <td className="px-3 py-2 tabular-nums">{amountLabel(s)}</td>
                  <td className="px-3 py-2">{s.billingCycle}</td>
                  <td className="px-3 py-2"><StatusBadge domain="subscription" status={s.status} /></td>
                  <td className="px-3 py-2 text-xs">{new Date(s.currentPeriodStart).toLocaleDateString()} → {new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                  <td className="relative px-3 py-2">
                    <div className="flex items-center gap-1">
                      {canRenew(s) && (
                        <button onClick={() => setRenewing(s)} className={`${btnGhost} px-2 py-1 text-xs`} title="Extend period + issue invoice">
                          Renew
                        </button>
                      )}
                      <button
                        onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                        aria-expanded={menuFor === s.id}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Lifecycle ▾
                      </button>
                    </div>
                    {menuFor === s.id && (
                      <div className="absolute right-3 z-20 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                        <p className="px-2 pb-1.5 pt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                          <strong className="text-zinc-700 dark:text-zinc-200">{s.status}:</strong> {STATUS_EXPLANATIONS[s.status]}
                        </p>
                        {(ALLOWED_TRANSITIONS[s.status] ?? []).length === 0 && (
                          <p className="px-2 pb-1 text-xs text-zinc-400">Terminal state — no transitions available.</p>
                        )}
                        {(ALLOWED_TRANSITIONS[s.status] ?? []).map((target) => (
                          <button
                            key={target}
                            onClick={() => { setMenuFor(null); setPending({ sub: s, status: target }); }}
                            className="block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            → {target}
                            <span className="block truncate text-[10px] font-normal text-zinc-400">{STATUS_EXPLANATIONS[target]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {creating && (
        <CreateModal orgs={orgs} plans={plans.filter((p) => p.isActive !== false)} countries={countries} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} busy={busy} setBusy={setBusy} error={error} setError={setError} />
      )}

      {/* Consequence-aware confirmation for EVERY lifecycle move — never silent */}
      <ConfirmDialog
        action={
          pending
            ? {
                ...(TRANSITION_COPY[pending.status] ?? { title: `Move to ${pending.status}`, consequences: ["Recorded on the audit log."], tone: "primary" as const }),
                message: `${pending.sub.organization.legalName} — ${pending.sub.plan.name}: ${pending.sub.status} → ${pending.status}.`,
                confirmLabel: TRANSITION_COPY[pending.status]?.title.split(" ")[0] ?? "Apply",
              }
            : null
        }
        onClose={() => setPending(null)}
        onConfirm={() => pending && transition(pending.sub.id, pending.status)}
      />

      <ConfirmDialog
        action={
          renewing
            ? {
                title: "Renew subscription",
                message: `Renew ${renewing.organization.legalName} — ${renewing.plan.name}?`,
                consequences: [
                  "A new invoice for the next period is issued immediately.",
                  "The current period end date advances by one full cycle.",
                  "If a payment gateway is attached, collection starts automatically.",
                ],
                confirmLabel: "Renew now",
                tone: "primary",
              }
            : null
        }
        onClose={() => setRenewing(null)}
        onConfirm={() => renewing && renew(renewing.id)}
      />
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
    try {
      const res = await fetch("/api/saas/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Create failed"); return; }
      onCreated();
    } finally {
      setBusy(false);
    }
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
