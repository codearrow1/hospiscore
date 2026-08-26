"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared focus trap hook. Traps Tab/Shift+Tab within `containerRef`, saves and
 * restores `document.activeElement`, and optionally calls `onEscape`.
 *
 * @param containerRef - ref to the trap container element
 * @param enabled      - when false the trap is inactive (e.g. panel closed)
 * @param opts.onEscape  - called on Escape keydown (typically closes the panel)
 * @param opts.initialFocusRef - if set, focuses this element on open instead of the first focusable
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  opts?: {
    onEscape?: () => void;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
  },
) {
  const restoreRef = useRef<HTMLElement | null>(null);
  const onEscape = opts?.onEscape;
  const initialFocusRef = opts?.initialFocusRef;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    const target = initialFocusRef?.current ?? container;
    const first = target?.querySelector<HTMLElement>(FOCUSABLE);
    setTimeout(() => (first ?? target)?.focus(), 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
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
  }, [enabled, containerRef, onEscape, initialFocusRef]);
}
