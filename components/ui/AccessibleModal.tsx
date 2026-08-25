"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sticky action footer for forms rendered inside a modal sheet. Pins to the
 * bottom of the sheet while long forms scroll above it.
 */
export const modalFooterCls =
  "sticky bottom-0 -mx-4 mt-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-5 sm:px-5";

/**
 * Accessible modal dialog: ESC to close, focus trap, focus restoration,
 * aria-modal labelling. Backdrop click closes only when `dismissOnBackdrop`.
 */
export function AccessibleModal({
  open,
  onClose,
  title,
  children,
  wide = false,
  dismissOnBackdrop = false,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  dismissOnBackdrop?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const target = initialFocusRef?.current ?? panelRef.current;
    const first = target?.querySelector<HTMLElement>(FOCUSABLE);
    setTimeout(() => (first ?? target)?.focus(), 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-start sm:overflow-y-auto sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl outline-none sm:max-h-[calc(100dvh-4rem)] sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-top))] sm:border-0 sm:bg-transparent sm:px-5 sm:pb-4 sm:pt-5">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 rounded-lg p-3.5 text-zinc-400 hover:bg-surface-subtle hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* Sheet body scrolls on mobile; desktop keeps its natural flow. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:overflow-visible sm:px-5 sm:pb-5 sm:pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
