"use client";

import { useEffect, useState } from "react";
import { AccessibleModal } from "./AccessibleModal";
import { Button, type ButtonVariant } from "./Button";

export interface ConfirmAction {
  title: string;
  /** One-line summary of what will happen. */
  message: string;
  /** Bullet list of concrete consequences shown before confirming. */
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary";
  /** For irreversible operations: user must type this exact phrase. */
  typeToConfirm?: string;
}

/**
 * Standard destructive-action confirmation with consequence messaging.
 * High-risk flows pass `typeToConfirm` (e.g. the object name).
 */
export function ConfirmDialog({
  action,
  onClose,
  onConfirm,
  busy = false,
}: {
  action: ConfirmAction | null;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const required = action?.typeToConfirm ?? null;

  useEffect(() => {
    setTyped("");
  }, [action]);

  const blocked = required !== null && typed.trim().toLowerCase() !== required.toLowerCase();
  if (!action) return null;

  const variant: ButtonVariant =
    action.tone === "primary" ? "primary" : action.tone === "warning" ? "secondary" : "danger-solid";

  return (
    <AccessibleModal open onClose={onClose} title={action.title} dismissOnBackdrop={!busy}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{action.message}</p>

      {action.consequences && action.consequences.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-line bg-surface-subtle p-3">
          {action.consequences.map((c) => (
            <li key={c} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 8v4m0 4h.01" />
              </svg>
              {c}
            </li>
          ))}
        </ul>
      )}

      {required !== null && (
        <div className="mt-3">
          <label htmlFor="confirm-type" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Type <span className="font-mono normal-case text-zinc-600 dark:text-zinc-300">{required}</span> to confirm
          </label>
          <input
            id="confirm-type"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {action.cancelLabel ?? "Cancel"}
        </Button>
        <Button
          variant={variant}
          onClick={onConfirm}
          loading={busy}
          loadingLabel="Working…"
          disabled={blocked}
        >
          {action.confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </AccessibleModal>
  );
}
