"use client";

/**
 * StaffQueueClient — actionable support/operations queue for the staff portal.
 * Tabs (Mine / Unassigned / All), SLA-aware sorting (breached first), a detail
 * drawer per ticket, and safe actions only: assign-to-me, release, and guarded
 * status transitions enforced server-side by PATCH /api/saas/support/[id].
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { btnGhost, btnPrimary, SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { canTransitionTicket, type TicketStatus } from "@/lib/saas/ticketRules";
import { formatMoney } from "@/lib/format";

export interface QueueTicket {
  id: string;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  requesterEmail: string | null;
  assigneeEmail: string | null;
  slaDueAtISO: string | null;
  firstResponseAtISO: string | null;
  resolvedAtISO: string | null;
  createdAtISO: string;
  organizationId: string;
  orgName: string;
  mrrCents: number;
  currency: string;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

function breached(t: QueueTicket): boolean {
  return !!t.slaDueAtISO && Date.parse(t.slaDueAtISO) < Date.now() && t.status !== "resolved" && t.status !== "closed";
}

function slaLabel(t: QueueTicket): string {
  if (!t.slaDueAtISO) return "no SLA";
  const diffMs = Date.parse(t.slaDueAtISO) - Date.now();
  const h = Math.round(Math.abs(diffMs) / 3_600_000);
  const m = Math.round((Math.abs(diffMs) % 3_600_000) / 60_000);
  const span = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diffMs < 0 ? `breached ${span} ago` : `due in ${span}`;
}

type Tab = "mine" | "unassigned" | "all";

export default function StaffQueueClient({ staffEmail, tickets }: { staffEmail: string; tickets: QueueTicket[] }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("mine");
  const [rows, setRows] = useState<QueueTicket[]>(tickets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const list = rows.filter((t) =>
      tab === "mine" ? t.assigneeEmail === staffEmail : tab === "unassigned" ? !t.assigneeEmail : true,
    );
    // Breached SLA first, then priority weight, then oldest.
    return [...list].sort((a, b) => {
      const ba = breached(a) ? 0 : 1;
      const bb = breached(b) ? 0 : 1;
      if (ba !== bb) return ba - bb;
      const pa = (PRIORITY_RANK[a.priority] ?? -1);
      const pb = (PRIORITY_RANK[b.priority] ?? -1);
      if (pa !== pb) return pb - pa;
      return Date.parse(a.createdAtISO) - Date.parse(b.createdAtISO);
    });
  }, [rows, tab, staffEmail]);

  const selected = rows.find((t) => t.id === selectedId) ?? null;

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/saas/support/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Action failed");
        return false;
      }
      if (d.ticket) {
        setRows((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: d.ticket.status,
                  assigneeEmail: d.ticket.assigneeEmail,
                  resolvedAtISO: d.ticket.resolvedAt ? new Date(d.ticket.resolvedAt).toISOString() : null,
                }
              : t,
          ),
        );
      }
      return true;
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    mine: rows.filter((t) => t.assigneeEmail === staffEmail).length,
    unassigned: rows.filter((t) => !t.assigneeEmail).length,
    all: rows.length,
  };
  const breachedCount = rows.filter(breached).length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "mine", label: `Mine (${counts.mine})` },
    { key: "unassigned", label: `Unassigned (${counts.unassigned})` },
    { key: "all", label: `All (${counts.all})` },
  ];

  return (
    <SectionCard title="Queue">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition " +
                (tab === t.key
                  ? "bg-surface text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")
              }
              aria-pressed={tab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
        {breachedCount > 0 && (
          <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {breachedCount} SLA breached
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here." body="No tickets match this view." />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.map((t) => {
            const isBreached = breached(t);
            return (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={"flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40 " + (isBreached ? "-mx-2 rounded-lg px-2" : "")}
                  aria-haspopup="dialog"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      {isBreached && <span aria-hidden className="text-red-500">●</span>}
                      <span className="truncate font-medium">{t.subject}</span>
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {t.orgName} · {t.category} · {t.assigneeEmail ?? "unassigned"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={"hidden text-[11px] font-semibold sm:inline " + (isBreached ? "text-red-600 dark:text-red-400" : "text-zinc-400")}>
                      {slaLabel(t)}
                    </span>
                    <StatusBadge domain="ticket" status={t.status} />
                    <span className="w-14 rounded-full bg-zinc-100 px-2 py-0.5 text-center text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t.priority}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected?.subject ?? ""} wide>
        {selected && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-zinc-500">Organization</dt>
              <dd className="font-medium">{selected.orgName}</dd>
              <dt className="text-zinc-500">Account MRR</dt>
              <dd className="tabular-nums">{formatMoney(selected.mrrCents, selected.currency)}</dd>
              <dt className="text-zinc-500">Requester</dt>
              <dd className="break-all">{selected.requesterEmail ?? "—"}</dd>
              <dt className="text-zinc-500">Assignee</dt>
              <dd>{selected.assigneeEmail ?? "unassigned"}</dd>
              <dt className="text-zinc-500">Created</dt>
              <dd>{new Date(selected.createdAtISO).toLocaleString()}</dd>
              <dt className="text-zinc-500">SLA</dt>
              <dd className={breached(selected) ? "font-semibold text-red-600 dark:text-red-400" : ""}>{slaLabel(selected)}</dd>
            </dl>

            {selected.description && (
              <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                {selected.description}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {selected.assigneeEmail !== staffEmail && (
                <button className={btnPrimary} disabled={busy} onClick={() => patch(selected.id, { assigneeEmail: staffEmail })}>
                  Assign to me
                </button>
              )}
              {selected.assigneeEmail && selected.assigneeEmail !== staffEmail && (
                <button className={btnGhost} disabled={busy} onClick={() => patch(selected.id, { assigneeEmail: "" })}>
                  Release ({selected.assigneeEmail.split("@")[0]})
                </button>
              )}
              {(["in_progress", "pending", "resolved", "closed"] as TicketStatus[])
                .filter((next) => canTransitionTicket(selected.status as TicketStatus, next))
                .map((next) => (
                  <button
                    key={next}
                    className={next === "resolved" || next === "closed" ? btnGhost : btnGhost}
                    disabled={busy}
                    onClick={() => patch(selected.id, { status: next })}
                  >
                    {next === "in_progress" ? "Start work" : next === "pending" ? "Wait on customer" : next === "resolved" ? "Resolve" : "Close"}
                  </button>
                ))}
              <Link href={`/saas/organizations/${selected.organizationId}`} className={btnGhost} onClick={() => setSelectedId(null)}>
                Open account →
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}
