"use client";

import { useEffect, useState } from "react";
import { AccessibleModal } from "@/components/ui/AccessibleModal";
import { Button } from "@/components/ui/Button";
import { LOST_REASONS, LOST_REASON_LABELS, type LostReason } from "@/lib/marketing/stages";

/**
 * Structured lost-reason picker replacing the old free-text prompt.
 * Values are constrained to the canonical LostReason set.
 */
export function LostReasonDialog({
  leadName,
  onClose,
  onConfirm,
  busy = false,
}: {
  leadName?: string;
  onClose: () => void;
  onConfirm: (reason: LostReason) => void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState<LostReason>("budget");

  useEffect(() => {
    setReason("budget");
  }, [leadName]);

  return (
    <AccessibleModal open onClose={onClose} title="Mark as lost" dismissOnBackdrop={!busy}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Why {leadName ? <span className="font-semibold">{leadName}</span> : "was this lead"} marked as lost? The
        reason feeds win/loss reporting.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {LOST_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(r)}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
              reason === r
                ? "border-indigo-400 bg-brand-soft font-semibold text-brand dark:border-indigo-600 dark:text-indigo-200"
                : "border-line hover:bg-surface-subtle"
            }`}
          >
            {LOST_REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => onConfirm(reason)} loading={busy} loadingLabel="Saving…">
          Mark lost
        </Button>
      </div>
    </AccessibleModal>
  );
}
