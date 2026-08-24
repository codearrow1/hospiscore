"use client";

import { useMemo, useState } from "react";
import type {
  BillingCycle,
  CountryListing,
  PlanId,
  PricingProfile,
  PricingRegion,
  TaxMode,
} from "@/lib/pricing/types";
import { CURRENCIES } from "@/lib/pricing/currencies";
import { PLAN_IDS, PLANS } from "@/lib/pricing/catalog";
import { GATEWAY_LABELS } from "@/lib/pricing/defaults";
import type { PricingDoc } from "@/lib/pricing/types";
import { annualSavings, formatPrice, taxLine } from "@/lib/pricing/engine";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const REGIONS: PricingRegion[] = ["na", "europe", "mena", "asia", "africa", "oceania", "global"];
const TAX_MODES: TaxMode[] = ["inclusive", "exclusive", "none"];

interface Draft extends PricingDoc {
  profiles: Record<string, PricingProfile>;
}

export default function PricingManager({
  initial,
  seeds,
}: {
  initial: PricingDoc;
  seeds: CountryListing[];
}) {
  const [draft, setDraft] = useState<Draft>(() => structuredClone(initial) as Draft);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Preview-as-customer
  const [previewCountry, setPreviewCountry] = useState("IN");
  const [previewPlan, setPreviewPlan] = useState<PlanId>("solopreneur");
  const [previewCycle, setPreviewCycle] = useState<BillingCycle>("monthly");

  const seedByCode = useMemo(() => new Map(seeds.map((s) => [s.code, s])), [seeds]);
  const usedCodes = new Set(Object.keys(draft.profiles));
  const addable = seeds.filter((s) => !usedCodes.has(s.code));

  function patchCountry(code: string, patch: Partial<PricingProfile>) {
    setDraft((d) => ({
      ...d,
      profiles: {
        ...d.profiles,
        [code]: { ...d.profiles[code], ...patch },
      },
    }));
    setStatus(null);
  }

  function patchPrice(code: string, plan: PlanId, field: "monthly" | "annual", value: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    patchCountry(code, {
      prices: {
        ...draft.profiles[code].prices,
        [plan]: { ...draft.profiles[code].prices[plan], [field]: num },
      },
    });
  }

  function addCountry(listing: CountryListing) {
    const base = structuredClone(draft.profiles.US) as PricingProfile;
    patchCountry(listing.code, {
      ...base,
      country: listing.code,
      name: listing.name,
      flag: listing.flag,
      currency: listing.currency,
      region: listing.region,
    });
    setLabel(`Added ${listing.name}`);
  }

  function removeCountry(code: string) {
    if (Object.keys(draft.profiles).length <= 1) {
      setStatus("Keep at least one country.");
      return;
    }
    setDraft((d) => {
      const profiles = { ...d.profiles };
      delete profiles[code];
      return { ...d, profiles };
    });
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles: draft.profiles,
          label: label || "Pricing update",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDraft(structuredClone(data.doc) as Draft);
      setLabel("");
      setStatus(`Saved as pricing version ${data.doc.version}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setDraft(structuredClone(data.doc) as Draft);
      setConfirmReset(false);
      setStatus(`Reset to seed defaults — now version ${data.doc.version}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  const previewProfile = draft.profiles[previewCountry];
  const previewPrice = previewProfile ? previewProfile.prices[previewPlan] : null;
  const previewSavings =
    previewPrice && previewCycle === "yearly"
      ? annualSavings(previewPrice.monthly, previewPrice.annual)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      {status && (
        <p
          role="status"
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            status.startsWith("Saved") || status.startsWith("Reset")
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {status}
        </p>
      )}

      {/* Version + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          Active version{" "}
          <span className="font-bold text-zinc-900 dark:text-zinc-50">{draft.version}</span>
          <span className="mx-2 text-zinc-400">·</span>
          {Object.keys(draft.profiles).length} country profiles
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Change label… (optional)"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save new pricing version"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={saving}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-rose-400 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            Reset to seeds
          </button>
        </div>
      </div>

      <ConfirmDialog
        action={confirmReset
          ? {
              title: "Reset pricing to seeds",
              message: "Reset every country profile to the built-in seed defaults?",
              consequences: [
                "All unsaved local edits in this editor are discarded.",
                "A new published pricing version is created immediately.",
                "Checkout prices change as soon as the version is saved.",
              ],
              confirmLabel: "Reset pricing",
              tone: "danger",
            }
          : null}
        onClose={() => setConfirmReset(false)}
        onConfirm={reset}
        busy={saving}
      />

      {/* Add country */}
      {addable.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Add a new country (prices start at the US profile — edit before saving)
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {addable.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => addCountry(c)}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                {c.flag} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Country editors */}
      <div className="flex flex-col gap-4">
        {Object.entries(draft.profiles).map(([code, p]) => {
          const seed = seedByCode.get(code);
          const flag = seed?.flag ?? p.flag ?? "";
          const name = seed?.name ?? p.name ?? code;
          return (
            <details
              key={code}
              className="group rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              open={code === "IN"}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-50">
                  {flag && <span aria-hidden="true">{flag}</span>}
                  {name}
                  <span className="text-xs font-normal text-zinc-500">{code}</span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {p.currency}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      removeCountry(code);
                    }}
                    className="text-xs text-zinc-400 transition hover:text-rose-500"
                  >
                    Remove
                  </button>
                </span>
              </summary>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {/* Currency + region */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-zinc-500">
                    Currency
                    <select
                      value={p.currency}
                      onChange={(e) => patchCountry(code, { currency: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {Object.keys(CURRENCIES).map((c) => (
                        <option key={c} value={c}>
                          {c} — {CURRENCIES[c].symbol}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-zinc-500">
                    Region
                    <select
                      value={p.region}
                      onChange={(e) => patchCountry(code, { region: e.target.value as PricingRegion })}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Tax */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-zinc-500">
                    Tax presentation
                    <select
                      value={p.tax.mode}
                      onChange={(e) =>
                        patchCountry(code, { tax: { ...p.tax, mode: e.target.value as TaxMode } })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {TAX_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-zinc-500">
                      Label
                      <input
                        value={p.tax.label}
                        onChange={(e) => patchCountry(code, { tax: { ...p.tax, label: e.target.value } })}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </label>
                    <label className="text-xs font-medium text-zinc-500">
                      Rate %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={p.tax.rate}
                        onChange={(e) =>
                          patchCountry(code, {
                            tax: { ...p.tax, rate: Number(e.target.value) || 0 },
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </label>
                  </div>
                </div>

                {/* Gateways */}
                <div>
                  <p className="text-xs font-medium text-zinc-500">Payment gateways</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(GATEWAY_LABELS).map(([id, label]) => {
                      const active = p.gateways.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            patchCountry(code, {
                              gateways: active
                                ? p.gateways.filter((g) => g !== id)
                                : [...p.gateways, id],
                            })
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            active
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                              : "border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Prices */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Plan</th>
                      <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Monthly</th>
                      <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Annual (per year)</th>
                      <th className="py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_IDS.map((pid) => {
                      const plan = PLANS.find((x) => x.id === pid)!;
                      const prices = p.prices[pid];
                      const isEnterprise = pid === "enterprise";
                      return (
                        <tr key={pid} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                          <td className="py-2 pr-4">
                            <span className="font-medium text-zinc-800 dark:text-zinc-100">{plan.name}</span>
                            {isEnterprise && (
                              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                                Custom
                              </span>
                            )}
                          </td>
                          {isEnterprise ? (
                            <td className="py-2 pr-4 text-sm text-zinc-400" colSpan={2}>
                              Custom pricing — arrange with sales
                            </td>
                          ) : (
                            <>
                              <td className="py-2 pr-4">
                                <input
                                  type="number"
                                  min={0}
                                  value={prices.monthly}
                                  onChange={(e) => patchPrice(code, pid, "monthly", e.target.value)}
                                  className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                              </td>
                              <td className="py-2 pr-4">
                                <input
                                  type="number"
                                  min={0}
                                  value={prices.annual}
                                  onChange={(e) => patchPrice(code, pid, "annual", e.target.value)}
                                  className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                              </td>
                            </>
                          )}
                          <td className="py-2 text-sm text-zinc-500">
                            {prices.monthly > 0
                              ? `${formatPrice(prices.monthly, p.currency)} / month`
                              : "Custom"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>

      {/* Preview as customer */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Preview as customer</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-zinc-500">
            Country
            <select
              value={previewCountry}
              onChange={(e) => setPreviewCountry(e.target.value)}
              className="mt-1 block rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {Object.keys(draft.profiles).map((c) => (
                <option key={c} value={c}>
                  {seedByCode.get(c)?.name ?? draft.profiles[c].name ?? c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Plan
            <select
              value={previewPlan}
              onChange={(e) => setPreviewPlan(e.target.value as PlanId)}
              className="mt-1 block rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {PLAN_IDS.map((p) => (
                <option key={p} value={p}>
                  {PLANS.find((x) => x.id === p)?.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Cycle
            <select
              value={previewCycle}
              onChange={(e) => setPreviewCycle(e.target.value as BillingCycle)}
              className="mt-1 block rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {previewProfile && previewPrice && previewPrice.monthly > 0
                ? formatPrice(
                    previewCycle === "yearly" ? previewPrice.annual : previewPrice.monthly,
                    previewProfile.currency,
                  )
                : "Custom"}
            </p>
            <p className="text-xs text-zinc-500">
              {previewCycle === "yearly" && previewSavings > 0
                ? `Save ${formatPrice(previewSavings, previewProfile?.currency ?? "USD")}/year`
                : previewProfile
                  ? taxLine(previewProfile)
                  : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Version history */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Version history</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {[...draft.history].reverse().map((v) => (
            <li key={v.version} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
              <span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">v{v.version}</span>
                <span className="mx-2 text-zinc-400">·</span>
                <span className="text-zinc-600 dark:text-zinc-300">
                  {v.label || "Pricing version"} {v.byEmail && <span className="text-zinc-400">by {v.byEmail}</span>}
                </span>
              </span>
              <span className="text-xs text-zinc-400">
                {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-900 dark:bg-indigo-950/30">
            <span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">v{draft.version}</span>
              <span className="mx-2 text-zinc-400">·</span>
              <span className="text-zinc-600 dark:text-zinc-300">Active — used by new customers</span>
            </span>
            <span className="text-xs text-zinc-400">Existing subscriptions keep their version</span>
          </li>
        </ul>
      </div>
    </div>
  );
}