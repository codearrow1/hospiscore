"use client";

import { useEffect, useState } from "react";

/**
 * Floating "back to top" button that appears after scrolling past a
 * threshold. Rendered globally from app/layout.tsx. Smooth-scrolls to the
 * top unless the user prefers reduced motion (then it jumps instantly).
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <button
      type="button"
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
      }
      className={`fixed bottom-5 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-zinc-200 shadow-lg shadow-black/40 backdrop-blur transition-all duration-300 hover:border-indigo-400 hover:text-indigo-300 hover:shadow-indigo-900/40 sm:bottom-6 sm:right-6 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none invisible translate-y-4 opacity-0"
      }`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}
