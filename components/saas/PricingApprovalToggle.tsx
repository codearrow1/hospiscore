"use client";

import { useState } from "react";

export default function PricingApprovalToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/saas/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireMarketingPricingApproval: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save setting");
        return;
      }
      setEnabled(next);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Require Marketing Admin pricing approval</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            When enabled, Marketing Admin users can propose changes to SaaS plan
            pricing and commercial configuration, but changes remain pending until
            a Super Admin explicitly approves them. This protects subscription
            pricing and billing integrity from unauthorized or accidental changes.
          </p>
          {enabled ? (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              ON — approval required. Proposed changes stay pending until a Super Admin approves them.
            </p>
          ) : (
            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              OFF — changes apply immediately (still audited).
            </p>
          )}
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={() => (enabled ? setConfirming(true) : persist(true))}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-600"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {!enabled && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Disabling this control allows authorized Marketing Admin users to change
          active plan pricing without Super Admin approval.
        </p>
      )}
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-rose-50 px-3 py-2 dark:bg-rose-500/10">
          <span className="text-sm text-rose-800 dark:text-rose-300">
            Really disable the approval requirement?
          </span>
          <button
            disabled={busy}
            onClick={() => persist(false)}
            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Yes, disable
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
