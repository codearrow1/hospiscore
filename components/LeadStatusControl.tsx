"use client";

import { useState } from "react";
import {
  isLeadStatus,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_STYLES,
  type LeadStatus,
} from "@/lib/accountTypes";

/**
 * Inline sales-status selector for a lead row. PATCHes /api/leads/[id] and
 * reflects the result optimistically; falls back to the previous value on error.
 */
export default function LeadStatusControl({
  leadId,
  status: initial,
}: {
  leadId: string;
  status: LeadStatus;
}) {
  const [status, setStatus] = useState<LeadStatus>(initial);
  const [busy, setBusy] = useState(false);

  async function onChange(next: LeadStatus) {
    if (!isLeadStatus(next) || next === status || busy) return;
    const previous = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`Status update failed (${res.status})`);
    } catch {
      setStatus(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400">Status</span>
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        disabled={busy}
        aria-label="Lead status"
        className={`min-h-11 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs font-medium outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 ${LEAD_STATUS_STYLES[status]}`}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
