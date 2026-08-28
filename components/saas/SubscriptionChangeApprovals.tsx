"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";

interface ExternalView {
  id: string;
  status: string;
  requestedByEmail: string;
  createdAt: string;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reason: string | null;
  organization: { id: string; legalName: string | null; businessName: string | null; country: string | null } | null;
  fromPlan: { id: string; name: string } | null;
  toPlan: { id: string; name: string } | null;
  billingCycle: string | null;
  proposedSnapshot: { currency?: string; prorationDeltaMinor?: number; unitAmount?: number | null } | null;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function SubscriptionChangeApprovals({ initial }: { initial: ExternalView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<ExternalView[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<ExternalView | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/saas/subscription-requests").catch(() => null);
    if (res?.ok) setItems(((await res.json()).requests ?? []) as ExternalView[]);
  }, []);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id);
    try {
      const payload: Record<string, unknown> = { decision };
      if (decision === "reject") payload.reason = reason.trim();
      const res = await fetch(`/api/saas/subscription-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Decision failed");
        return;
      }
      toast.success(decision === "approve" ? "Plan change applied." : "Request rejected.");
      setRejectFor(null);
      setReason("");
      await load();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const pending = items.filter((r) => r.status === "pending");
  const past = items.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <SectionCard title="Pending customer plan changes" subtitle="Approve applies the switch via the canonical billing service; reject requires a reason.">
        {pending.length === 0 ? (
          <EmptyState title="Nothing pending" body="No customer plan-change requests are waiting for review." />
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {r.fromPlan?.name ?? "—"} → {r.toPlan?.name ?? "—"}
                      {r.billingCycle ? ` (${r.billingCycle})` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.organization?.legalName || r.organization?.businessName || "Unknown org"}
                      {r.organization?.country ? ` · ${r.organization.country}` : ""} · requested by {r.requestedByEmail} · {fmtDate(r.createdAt)}
                    </p>
                    {r.reason && <p className="mt-0.5 text-xs text-zinc-400">{r.reason}</p>}
                    {r.proposedSnapshot?.prorationDeltaMinor ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Prorated adjustment: {formatMoney(r.proposedSnapshot.prorationDeltaMinor, r.proposedSnapshot.currency, { signed: true })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={
                        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                      }
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      className={
                        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-surface-subtle dark:text-zinc-200 disabled:opacity-60"
                      }
                      disabled={busyId === r.id}
                      onClick={() => { setRejectFor(r); setReason(""); }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {past.length > 0 && (
        <SectionCard title="Recent decisions">
          <ul className="divide-y divide-line text-sm">
            {past.slice(0, 20).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <strong>{r.fromPlan?.name ?? "—"}</strong> → <strong>{r.toPlan?.name ?? "—"}</strong>
                  <span className="text-zinc-400"> · {fmtDate(r.createdAt)}</span>
                  {r.rejectionReason && <span className="block text-xs text-rose-500">Rejected: {r.rejectionReason}</span>}
                </span>
                <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold " + (r.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300")}>
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Reject plan change</h2>
            <p className="mt-1 text-sm text-zinc-500">{rejectFor.fromPlan?.name ?? "—"} → {rejectFor.toPlan?.name ?? "—"}</p>
            <label className="mt-3 mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Reason (required)</label>
            <textarea
              className="w-full min-h-20 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this request being rejected?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="inline-flex min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200" onClick={() => setRejectFor(null)}>
                Cancel
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                disabled={reason.trim().length === 0 || busyId === rejectFor.id}
                onClick={() => void decide(rejectFor.id, "reject")}
              >
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
