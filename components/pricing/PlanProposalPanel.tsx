"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ProposalPlanView {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  isActive: boolean;
}

export interface ProposalRequestView {
  id: string;
  planId: string;
  status: string;
  requestedByEmail: string;
  createdAt: string;
  reason: string | null;
  rejectionReason: string | null;
  proposedSnapshot: { monthlyPrice?: number; annualPrice?: number; name?: string };
}

function usd(cents: unknown): string {
  return typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "—";
}

/**
 * Marketing-side panel on the pricing admin page: shows the canonical SaaS
 * plan (single source of truth) and lets Marketing Admin propose commercial
 * changes. With approval ON nothing changes until a Super Admin approves.
 */
export default function PlanProposalPanel({
  plans,
  requests,
  approvalRequired,
}: {
  plans: ProposalPlanView[];
  requests: ProposalRequestView[];
  approvalRequired: boolean;
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [monthly, setMonthly] = useState("");
  const [annual, setAnnual] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function openForm(plan: ProposalPlanView) {
    setOpenFor(openFor === plan.id ? null : plan.id);
    setMonthly((plan.monthlyPrice / 100).toFixed(2));
    setAnnual((plan.annualPrice / 100).toFixed(2));
    setName(plan.name);
    setReason("");
    setMsg(null);
  }

  async function submit(plan: ProposalPlanView) {
    setBusy(true);
    setMsg(null);
    try {
      const patch: Record<string, unknown> = {};
      if (Number(monthly) * 100 !== plan.monthlyPrice) patch.monthlyPrice = Math.round(Number(monthly) * 100);
      if (Number(annual) * 100 !== plan.annualPrice) patch.annualPrice = Math.round(Number(annual) * 100);
      if (name.trim() && name.trim() !== plan.name) patch.name = name.trim();
      if (Object.keys(patch).length === 0) {
        setMsg({ kind: "err", text: "Nothing changed." });
        return;
      }
      const res = await fetch("/api/saas/plan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, patch, reason }),
      });
      const data = (await res.json()) as { error?: string; outcome?: string };
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Submit failed" });
        return;
      }
      setMsg({
        kind: "ok",
        text:
          data.outcome === "pending"
            ? "Submitted — pending Super Admin approval."
            : "Applied immediately (approval requirement is off).",
      });
      setOpenFor(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/saas/plan-requests/${id}/cancel`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">SaaS plan catalog</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            approvalRequired
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          }`}
        >
          {approvalRequired ? "Changes require Super Admin approval" : "Direct changes enabled"}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Canonical billing prices live in the SaaS control plane and are shown here
        read-only until approved. The US baseline of the localized table above is
        derived from these values.
      </p>
      {msg && (
        <p className={`mt-2 text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>
      )}
      <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {plans.map((p) => {
          const pending = requests.filter((r) => r.planId === p.id && r.status === "pending");
          const recent = requests.filter((r) => r.planId === p.id).slice(0, 3);
          return (
            <div key={p.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{p.slug}</span>
                  {!p.isActive && (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">
                    {usd(p.monthlyPrice)}/mo · {usd(p.annualPrice)}/yr
                  </span>
                  <button
                    onClick={() => openForm(p)}
                    className="rounded-md border border-indigo-300 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                  >
                    Propose change
                  </button>
                </div>
              </div>

              {pending.map((r) => (
                <div key={r.id} className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm dark:bg-amber-500/10">
                  <span className="font-medium text-amber-800 dark:text-amber-300">Pending Super Admin approval:</span>{" "}
                  proposed {r.proposedSnapshot.name ? `"${r.proposedSnapshot.name}" · ` : ""}
                  {usd(r.proposedSnapshot.monthlyPrice ?? p.monthlyPrice)}/mo ·{" "}
                  {usd(r.proposedSnapshot.annualPrice ?? p.annualPrice)}/yr — requested by {r.requestedByEmail}
                  <button
                    disabled={busy}
                    onClick={() => cancel(r.id)}
                    className="ml-3 rounded border border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:text-amber-300"
                  >
                    Cancel request
                  </button>
                </div>
              ))}
              {!pending.length &&
                recent.map((r) =>
                  r.status === "rejected" ? (
                    <div key={r.id} className="mt-2 text-xs text-rose-600">
                      Last proposal rejected{r.rejectionReason ? `: ${r.rejectionReason}` : ""}
                    </div>
                  ) : r.status === "approved" ? (
                    <div key={r.id} className="mt-2 text-xs text-emerald-600">Latest proposal approved ✓</div>
                  ) : null,
                )}

              {openFor === p.id && (
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <label className="text-xs text-zinc-500">
                    Name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Monthly (USD)
                    <input
                      value={monthly}
                      onChange={(e) => setMonthly(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Annual (USD)
                    <input
                      value={annual}
                      onChange={(e) => setAnnual(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Reason
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why this change?"
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    />
                  </label>
                  <div className="sm:col-span-4">
                    <button
                      disabled={busy || !Number.isFinite(Number(monthly)) || !Number.isFinite(Number(annual))}
                      onClick={() => submit(p)}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      Submit proposal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
