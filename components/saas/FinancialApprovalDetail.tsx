"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";

export interface DetailApproval {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  amountMinor: number;
  currency: string;
  requesterEmail: string;
  reviewerEmail: string | null;
  status: string;
  reason: string | null;
  decisionReason: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  executedAt: string | null;
  failedAt: string | null;
  expiresAt: string | null;
  executionError: string | null;
  snapshot: Record<string, unknown> | null;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

export default function FinancialApprovalDetail({
  approval,
  current,
  differences,
  actionLabel,
  canApprove,
  viewerEmail,
  organization,
}: {
  approval: DetailApproval;
  current: Record<string, unknown> | null;
  differences: string[];
  actionLabel: string;
  canApprove: boolean;
  viewerEmail?: string | null;
  organization: { legalName: string | null; businessName: string | null; country: string | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const isSelf = viewerEmail && viewerEmail.toLowerCase() === approval.requesterEmail.toLowerCase();
  const pending = approval.status === "pending";

  const act = async (decision: "approve" | "reject" | "cancel") => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { decision };
      if (decision === "reject") payload.reason = reason.trim();
      const res = await fetch(`/api/saas/financial-approvals/${approval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Action failed");
        return;
      }
      toast.success(decision === "approve" ? "Approved — executed the financial action." : decision === "reject" ? "Request rejected." : "Request cancelled.");
      setConfirmApprove(false);
      setShowReject(false);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/saas/financial-approvals" className="text-sm text-indigo-600 hover:underline dark:text-indigo-300">
        ← Back to approvals
      </Link>

      <SectionCard title={actionLabel} subtitle={`Four-eyes approval request · ${approval.targetType}:${approval.targetId}`}>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{formatMoney(approval.amountMinor, approval.currency)}</span>
          <StatusBadge status={approval.status} domain="financialApproval" />
          {!canApprove && pending && isSelf && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              You requested this — cannot self-approve
            </span>
          )}
        </div>

        {organization && (
          <Row
            label="Organization"
            value={`${organization.legalName || organization.businessName || "Unknown org"}${organization.country ? ` · ${organization.country}` : ""}`}
          />
        )}
        <Row label="Requester" value={approval.requesterEmail} />
        {approval.reviewerEmail && <Row label="Approver" value={approval.reviewerEmail} />}
        <Row label="Requested" value={fmtDate(approval.requestedAt)} />
        {approval.expiresAt && pending && <Row label="Decision deadline" value={fmtDate(approval.expiresAt)} />}
        {approval.reason && <Row label="Request rationale" value={approval.reason} />}
        {approval.decisionReason && <Row label="Decision rationale" value={approval.decisionReason} />}
        {approval.executionError && <Row label="Execution error" value={<span className="text-rose-600 dark:text-rose-400">{approval.executionError}</span>} />}

        {pending && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canApprove && !isSelf && (
              <>
                <button
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setConfirmApprove(true)}
                >
                  Approve &amp; execute
                </button>
                <button
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-surface-subtle disabled:opacity-60 dark:text-rose-400"
                  disabled={busy}
                  onClick={() => { setShowReject(true); setReason(""); }}
                >
                  Reject
                </button>
              </>
            )}
            <button
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-surface-subtle disabled:opacity-60 dark:text-zinc-300"
              disabled={busy}
              onClick={() => void act("cancel")}
            >
              Cancel request
            </button>
          </div>
        )}

        {!canApprove && pending && !isSelf && (
          <p className="mt-4 text-xs text-zinc-400">You can view this request but do not have approval rights (FINANCIAL_APPROVE).</p>
        )}
      </SectionCard>

      <SectionCard title="Current state vs requested snapshot" subtitle="If anything drifted since the request, approving is blocked.">
        {differences.length === 0 ? (
          <EmptyState title="No drift" body="The target still matches the requested snapshot." />
        ) : (
          <ul className="space-y-1">
            {differences.map((d, i) => (
              <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                {d}
              </li>
            ))}
          </ul>
        )}
        {current && (
          <div className="mt-4 rounded-xl border border-line bg-surface-subtle p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Snapshot captured at request time</p>
            <pre className="whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-300">
              {JSON.stringify(approval.snapshot ?? {}, null, 2)}
            </pre>
            <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Current target state</p>
            <pre className="whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-300">{JSON.stringify(current, null, 2)}</pre>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Timeline">
        {approval.status === "pending" ? (
          <EmptyState title="Awaiting decision" body="This request has not been approved or rejected yet." />
        ) : (
          <div className="space-y-2 text-sm">
            <p>Requested at {fmtDate(approval.requestedAt)}</p>
            {approval.approvedAt && <p className="text-emerald-600 dark:text-emerald-400">Approved at {fmtDate(approval.approvedAt)}</p>}
            {approval.rejectedAt && <p className="text-rose-600 dark:text-rose-400">Rejected at {fmtDate(approval.rejectedAt)}</p>}
            {approval.cancelledAt && <p>Cancelled at {fmtDate(approval.cancelledAt)}</p>}
            {approval.expiredAt && <p>Expired at {fmtDate(approval.expiredAt)}</p>}
            {approval.executedAt && <p className="text-emerald-600 dark:text-emerald-400">Executed at {fmtDate(approval.executedAt)}</p>}
            {approval.failedAt && <p className="text-rose-600 dark:text-rose-400">Failed at {fmtDate(approval.failedAt)}</p>}
          </div>
        )}
      </SectionCard>

      {confirmApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Approve {actionLabel.toLowerCase()}?</h2>
            <p className="mt-1 text-sm text-zinc-500">
              You are about to approve {formatMoney(approval.amountMinor, approval.currency)} for {approval.requesterEmail}. This will{" "}
              <strong>execute the financial action immediately</strong> via the canonical billing service. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                onClick={() => setConfirmApprove(false)}
                disabled={busy}
              >
                Go back
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                disabled={busy}
                onClick={() => void act("approve")}
              >
                Approve &amp; execute
              </button>
            </div>
          </div>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Reject {actionLabel.toLowerCase()}</h2>
            <p className="mt-1 text-sm text-zinc-500">{formatMoney(approval.amountMinor, approval.currency)} from {approval.requesterEmail}</p>
            <label className="mt-3 mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Reason (required)</label>
            <textarea
              className="w-full min-h-20 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being rejected?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                onClick={() => setShowReject(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                disabled={reason.trim().length === 0 || busy}
                onClick={() => void act("reject")}
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
