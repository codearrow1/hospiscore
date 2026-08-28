"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";

export interface OrgRef {
  id: string;
  legalName: string | null;
  businessName: string | null;
  country: string | null;
}

export interface ApprovalView {
  id: string;
  actionType: string;
  actionLabel: string;
  targetType: string;
  targetId: string;
  amountMinor: number;
  currency: string;
  requesterEmail: string;
  status: string;
  reason: string | null;
  decisionReason: string | null;
  reviewerEmail: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  executedAt: string | null;
  executionError: string | null;
  organization: OrgRef | null;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function ageLabel(requestedAt: string): string {
  const ms = Date.now() - Date.parse(requestedAt);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FinancialApprovalQueue({
  initial,
  counts,
  canApprove,
  viewerEmail,
}: {
  initial: ApprovalView[];
  counts: { pending: number; highValue: number; expiring: number };
  canApprove: boolean;
  viewerEmail?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<ApprovalView[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<ApprovalView | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/saas/financial-approvals").catch(() => null);
    if (res?.ok) {
      const d = await res.json().catch(() => ({}));
      setItems((d.approvals ?? []) as ApprovalView[]);
    }
  }, []);

  const decide = async (id: string, decision: "approve" | "reject" | "cancel") => {
    setBusyId(id);
    try {
      const payload: Record<string, unknown> = { decision };
      if (decision === "reject") payload.reason = reason.trim();
      const res = await fetch(`/api/saas/financial-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Action failed");
        return;
      }
      toast.success(
        decision === "approve" ? "Approved — financial action executed." : decision === "reject" ? "Request rejected." : "Request cancelled.",
      );
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
      {counts.pending > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Pending review</p>
            <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">High value (≥ ₹10,000)</p>
            <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-200">{counts.highValue}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Expiring within 36h</p>
            <p className="mt-1 text-3xl font-bold text-rose-700 dark:text-rose-200">{counts.expiring}</p>
          </div>
        </div>
      )}

      <SectionCard
        title="Pending financial approvals"
        subtitle="Approving executes the financial action via the canonical billing service. The requester and approver must be different users."
      >
        {pending.length === 0 ? (
          <EmptyState title="Nothing pending" body="No high-risk financial actions are waiting for review." />
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => {
              const isSelf = viewerEmail && viewerEmail.toLowerCase() === r.requesterEmail.toLowerCase();
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/saas/financial-approvals/${r.id}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                      >
                        {r.actionLabel}
                      </Link>
                      <span className="ml-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatMoney(r.amountMinor, r.currency)}
                      </span>
                      <p className="text-xs text-zinc-500">
                        {r.organization ? `${r.organization.legalName || r.organization.businessName || "Unknown org"}` : r.targetId}
                        {r.organization?.country ? ` · ${r.organization.country}` : ""} · {r.targetType}:{r.targetId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-zinc-400">
                        requested by <span className="text-zinc-600 dark:text-zinc-300">{r.requesterEmail}</span> · {ageLabel(r.requestedAt)} · expires {fmtDate(r.expiresAt)}
                      </p>
                      {r.reason && <p className="mt-0.5 text-xs text-zinc-400">{r.reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelf && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">self</span>}
                      {canApprove && !isSelf && (
                        <button
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                          disabled={busyId !== null}
                          onClick={() => void decide(r.id, "approve")}
                        >
                          Approve
                        </button>
                      )}
                      {canApprove && (
                        <button
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-surface-subtle disabled:opacity-60 dark:text-rose-400"
                          disabled={busyId !== null}
                          onClick={() => { setRejectFor(r); setReason(""); }}
                        >
                          Reject
                        </button>
                      )}
                      <button
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-surface-subtle disabled:opacity-60 dark:text-zinc-300"
                        disabled={busyId !== null}
                        onClick={() => void decide(r.id, "cancel")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {past.length > 0 && (
        <SectionCard title="Recent decisions">
          <ul className="divide-y divide-line text-sm">
            {past.slice(0, 30).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link href={`/saas/financial-approvals/${r.id}`} className="min-w-0 hover:underline">
                  <strong className="text-zinc-900 dark:text-zinc-50">{r.actionLabel}</strong>
                  <span className="text-zinc-600 dark:text-zinc-300"> · {formatMoney(r.amountMinor, r.currency)}</span>
                  <span className="text-zinc-400"> · {fmtDate(r.requestedAt)}</span>
                  <span className="block text-[11px] text-zinc-400">
                    {r.requesterEmail}
                    {r.reviewerEmail ? ` → ${r.reviewerEmail}` : ""}
                  </span>
                  {r.status === "failed" && r.executionError && (
                    <span className="block text-xs text-rose-500">Failed: {r.executionError}</span>
                  )}
                  {r.status === "rejected" && r.decisionReason && (
                    <span className="block text-xs text-rose-500">Rejected: {r.decisionReason}</span>
                  )}
                </Link>
                <StatusBadge status={r.status} domain="financialApproval" />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Reject {rejectFor.actionLabel.toLowerCase()}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {formatMoney(rejectFor.amountMinor, rejectFor.currency)} from {rejectFor.requesterEmail}
            </p>
            <label className="mt-3 mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Reason (required)</label>
            <textarea
              className="w-full min-h-20 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this request being rejected?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                onClick={() => setRejectFor(null)}
              >
                Cancel
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                disabled={reason.trim().length === 0 || busyId !== null}
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
