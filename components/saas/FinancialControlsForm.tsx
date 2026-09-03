"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import type { FinancialControlsSettings, FinancialActionType, FinancialControlRule } from "@/lib/saas/financialApproval";

const ACTIONS: { type: FinancialActionType; label: string; description: string; defaultThresholdMinor: number }[] = [
  { type: "invoice.void", label: "Invoice void", description: "Voiding an issued/past-due invoice.", defaultThresholdMinor: 0 },
  { type: "payment.refund", label: "Payment refund", description: "Issuing a full refund on a succeeded payment.", defaultThresholdMinor: 1_000_00 },
  { type: "payout.release", label: "Payout release", description: "Releasing an affiliate payout to paid.", defaultThresholdMinor: 0 },
];

const MODE_LABELS: Record<FinancialControlRule["mode"], string> = {
  always_four_eyes: "Always require approval",
  threshold: "Approval above threshold",
  off: "No approval (direct)",
};

export default function FinancialControlsForm({ viewerEmail }: { viewerEmail?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<Partial<Record<FinancialActionType, { mode: FinancialControlRule["mode"]; thresholdUnits: string }>>>({});
  const [expiryVal, setExpiryVal] = useState("72");

  const load = useCallback(async () => {
    const res = await fetch("/api/saas/financial-controls").catch(() => null);
    if (!res?.ok) {
      toast.error("Could not load financial controls.");
      setLoading(false);
      return;
    }
    const d = await res.json().catch(() => ({}));
    const s = (d.settings ?? {}) as Partial<FinancialControlsSettings>;
    setEnabled(s.enabled !== false);
    setExpiryVal(String(s.expirationHours ?? 72));
    const next: typeof rules = {};
    for (const a of ACTIONS) {
      const r = s.actions?.[a.type];
      const mode = r?.mode ?? "always_four_eyes";
      const thresholdMenor = r?.thresholdMinor ?? a.defaultThresholdMinor;
      next[a.type] = { mode, thresholdUnits: (thresholdMenor / 100).toFixed(0) };
    }
    setRules(next);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setMode = (type: FinancialActionType, mode: FinancialControlRule["mode"]) => {
    setRules((prev) => ({ ...prev, [type]: { ...(prev[type] ?? { thresholdUnits: "0" }), mode } }));
  };
  const setThreshold = (type: FinancialActionType, units: string) => {
    const digits = units.replace(/[^0-9]/g, "");
    setRules((prev) => ({ ...prev, [type]: { mode: prev[type]?.mode ?? "always_four_eyes", thresholdUnits: digits } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const actions: NonNullable<FinancialControlsSettings["actions"]> = {};
      for (const a of ACTIONS) {
        const r = rules[a.type] ?? { mode: "always_four_eyes" as const, thresholdUnits: "0" };
        const thresholdMinor = Math.max(0, parseInt(r.thresholdUnits || "0", 10)) * 100;
        actions[a.type] =
          r.mode === "threshold"
            ? { mode: "threshold", thresholdMinor }
            : { mode: r.mode };
      }
      const payload: FinancialControlsSettings = {
        enabled,
        expirationHours: Math.max(1, parseInt(expiryVal || "72", 10)),
        actions,
      };
      const res = await fetch("/api/saas/financial-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Save failed");
        return;
      }
      toast.success("Financial controls updated. Policy is enforced immediately.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Dual-approval policy"
        subtitle="When disabled, the four-eyes requirement is bypassed and direct void/refund/payout is allowed (not recommended)."
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Enforce four-eyes financial controls</span>
              <span className="block text-xs text-zinc-500">Requires a second, independent approver for gated actions.</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-zinc-600 dark:text-zinc-300" htmlFor="fa-expiry">
              Approval valid for
            </label>
            <input
              id="fa-expiry"
              type="number"
              min={1}
              className="w-24 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
              value={expiryVal}
              onChange={(e) => setExpiryVal(e.target.value)}
            />
            <span className="text-sm text-zinc-500">hours before a pending approval expires.</span>
          </div>
        </div>
      </SectionCard>

      {ACTIONS.map((a) => {
        const r = rules[a.type] ?? { mode: "always_four_eyes" as const, thresholdUnits: "0" };
        return (
          <SectionCard key={a.type} title={a.label} subtitle={a.description}>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Rule</label>
                <select
                  className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                  value={r.mode}
                  onChange={(e) => setMode(a.type, e.target.value as FinancialControlRule["mode"])}
                >
                  <option value="always_four_eyes">{MODE_LABELS.always_four_eyes}</option>
                  <option value="threshold">{MODE_LABELS.threshold}</option>
                  <option value="off">{MODE_LABELS.off}</option>
                </select>
              </div>
              {r.mode === "threshold" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Threshold (currency units)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-32 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                    value={r.thresholdUnits}
                    onChange={(e) => setThreshold(a.type, e.target.value)}
                    placeholder="10000"
                  />
                </div>
              )}
              <p className="w-full pb-1 text-xs text-zinc-400">
                {r.mode === "always_four_eyes"
                  ? "Every action of this type requires a second approver."
                  : r.mode === "threshold"
                    ? `Requires approval when the amount is ≥ ${(parseInt(r.thresholdUnits || "0", 10) * 100 / 100).toLocaleString()} units.`
                    : "This action is allowed directly, without four-eyes approval."}
              </p>
            </div>
          </SectionCard>
        );
      })}

      <div className="flex justify-end gap-2">
        {viewerEmail && <span className="mr-auto self-center text-xs text-zinc-400">Editing as {viewerEmail}</span>}
        <button
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save financial controls"}
        </button>
      </div>
    </div>
  );
}
