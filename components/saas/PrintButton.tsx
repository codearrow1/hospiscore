"use client";

/** Print button for the customer invoice view (browser print → Save as PDF). */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-surface-subtle print:hidden dark:text-zinc-200"
    >
      Print / Save as PDF
    </button>
  );
}
