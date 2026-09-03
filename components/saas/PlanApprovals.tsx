"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatMoney } from "@/lib/format";

export interface ApprovalRequestView {
  id: string;
  planId: string | null;
  action: string;
  status: string;
  requestedByEmail: string;
  reason: string | null;
  baseVersion: number;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  beforeSnapshot: Record<string, unknown>;
  proposedSnapshot: Record<string, unknown> | null;
  plan?: { name?: string; slug?: string; version?: number } | null;
}

export type ApprovalImpact = { subscribers: number; mrrCents: number; newMonthly: number | null };

const FIELDS: [string, string][] = [
  ["name", "Name"],
  ["slug", "Slug"],
  ["monthlyPrice", "Monthly price"],
  ["annualPrice", "Annual price"],
  ["trialDays", "Trial days"],
  ["roomMin", "Room min"],
  ["roomMax", "Room max"],
  ["adminLimit", "Admin seats"],
  ["staffLimit", "Staff seats"],
  ["featured", "Featured"],
  ["displayOrder", "Display order"],
  ["isCustomPrice", "Custom pricing"],
  ["isActive", "Active"],
];

const ACTION_LABELS: Record<string, string> = {
  update: "Update",
  create: "Create new plan",
  archive: "Archive",
  activate: "Activate",
  deactivate: "Deactivate",
};

function fmt(field: string, v: unknown, currency?: unknown): string {
  if (v === undefined || v === null) return "—";
  if (field.endsWith("Price")) {
    // Snapshot prices carry the plan's record currency alongside them.
    const code = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency) ? currency : null;
    return code ? formatMoney(v as number, code) : `${((v as number) / 100).toFixed(2)} (ledger units)`;
  }
  if (typeof v === "boolean") return field === "featured" ? (v ? "Featured" : "—") : v ? "Yes" : "No";
  return String(v);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    cancelled: "bg-zinc-200 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.cancelled}`}>
      {status}
    </span>
  );
}

export default function PlanApprovals({ requests, isSuper, impact = {} }: {
  requests: ApprovalRequestView[];
  isSuper: boolean;
  impact?: Record<string, ApprovalImpact>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [approving, setApproving] = useState<ApprovalRequestView | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const visible = useMemo(
    () => (filter === "pending" ? requests.filter((r) => r.status === "pending") : requests),
    [requests, filter],
  );

  async function act(id: string, action: "approve" | "reject" | "cancel", reasonText?: string) {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch(`/api/saas/plan-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: reasonText ?? "" } : {}),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `${action} failed`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
      setRejecting(null);
      setReason("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {f === "pending" ? "Pending" : "All"}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {visible.length === 0 && <p className="text-sm text-zinc-500">No {filter} requests.</p>}
      {visible.map((r) => {
        const diffs = r.proposedSnapshot
          ? FIELDS.filter(([f]) => JSON.stringify(r.beforeSnapshot?.[f]) !== JSON.stringify(r.proposedSnapshot![f]))
          : [];
        return (
          <div key={r.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  {ACTION_LABELS[r.action] ?? r.action}
                </span>
                <span className="ml-2 font-semibold">{String(r.plan?.name ?? r.proposedSnapshot?.name ?? "Plan")}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  slug:{r.plan?.slug ?? String(r.proposedSnapshot?.slug ?? "")} · requested by {r.requestedByEmail} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {diffs.length === 0 && r.action === "update" && <dt className="text-zinc-500">No field changes.</dt>}
              {diffs.map(([f, label]) => (
                <div key={f} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
                  <dd>
                    <span className="line-through opacity-60">{fmt(f, r.beforeSnapshot?.[f], r.beforeSnapshot?.currency)}</span>{" "}
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {fmt(f, r.proposedSnapshot![f], r.proposedSnapshot!.currency)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            {r.reason && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Reason: {r.reason}</p>}
            {impact[r.id] && (impact[r.id].subscribers > 0 || impact[r.id].newMonthly != null) && (
              <p className="mt-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                <strong className="font-semibold">Impact:</strong>{" "}
                {impact[r.id].subscribers} active subscriber{impact[r.id].subscribers === 1 ? "" : "s"} on this plan
                {impact[r.id].newMonthly != null && (
                  <> · proposed monthly price ${(impact[r.id].newMonthly as number) / 100}{impact[r.id].subscribers > 0 ? " applies at renewal" : ""}</>
                )}
              </p>
            )}
            {r.status === "rejected" && r.rejectionReason && (
              <p className="mt-2 text-sm text-rose-600">Rejected: {r.rejectionReason}</p>
            )}
            {r.status === "approved" && r.reviewedByEmail && (
              <p className="mt-2 text-xs text-zinc-500">
                Approved by {r.reviewedByEmail} · {r.reviewedAt && new Date(r.reviewedAt).toLocaleString()}
              </p>
            )}
            {isSuper && r.status === "pending" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() => setApproving(r)}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => {
                    setRejecting(rejecting === r.id ? null : r.id);
                    setReason("");
                  }}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  Reject
                </button>
                {!rejecting || rejecting !== r.id ? null : (
                  <div className="flex w-full max-w-md items-center gap-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Rejection reason (required)"
                      className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
                    />
                    <button
                      disabled={busy !== null || !reason.trim()}
                      onClick={() => act(r.id, "reject", reason)}
                      className="rounded-md bg-rose-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Confirm reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        action={
          approving
            ? {
                title: "Approve plan change",
                message: `${ACTION_LABELS[approving.action] ?? approving.action} — ${String(approving.plan?.name ?? approving.proposedSnapshot?.name ?? "Plan")}`,
                consequences: [
                  "The proposal is applied to the canonical plan and versioned.",
                  "The storefront baseline re-syncs immediately.",
                  ...(impact[approving.id]?.subscribers > 0 ? [`Affects ${impact[approving.id].subscribers} existing subscriber${impact[approving.id].subscribers === 1 ? "" : "s"} at their next renewal.`] : []),
                  "This decision is recorded on the audit log under your account.",
                ],
                confirmLabel: "Approve",
                tone: "primary",
              }
            : null
        }
        onClose={() => setApproving(null)}
        onConfirm={() => approving && act(approving.id, "approve")}
      />
    </div>
  );
}
