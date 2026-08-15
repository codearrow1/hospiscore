"use client";

import { useState } from "react";
import { FAQS } from "@/lib/faq";

/**
 * Smooth client accordion. Uses the CSS `grid-template-rows: 0fr → 1fr`
 * transition trick so answers expand/collapse with a natural height animation
 * instead of <details> jumping. One item is open at a time; the first FAQ is
 * open by default. Honors prefers-reduced-motion via the `.faq-panel` styles.
 */
export default function Faq() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-3">
        {FAQS.map((f, i) => {
          const open = openIdx === i;
          return (
            <div
              key={f.q}
              className={`group rounded-2xl border bg-white p-5 transition hover:border-indigo-300 dark:bg-zinc-900 dark:hover:border-indigo-800 ${
                open
                  ? "border-indigo-300 shadow-lg shadow-indigo-500/5 dark:border-indigo-800"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : i)}
                aria-expanded={open}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-base font-medium text-zinc-900 dark:text-zinc-50"
              >
                {f.q}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-transform duration-300 dark:text-zinc-300 ${
                    open
                      ? "rotate-45 bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                  aria-hidden="true"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
                  </svg>
                </span>
              </button>
              <div
                id={`faq-panel-${i}`}
                className={`faq-panel grid transition-[grid-template-rows] duration-300 ease-out ${
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
