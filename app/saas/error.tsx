"use client";

import { useEffect } from "react";

export default function SaasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[saas] route error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-sm font-bold text-red-600 dark:text-red-400">Something went wrong</p>
      <p className="mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
        The control plane hit an unexpected error. Your data is safe — retry, and if it persists
        contact support with the reference below.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          ref: {error.digest}
        </p>
      )}
      {/* TEMP-DIAG: surface the real client-side error message */}
      <pre className="mt-3 max-w-full overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-left font-mono text-[10px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      {/* END TEMP-DIAG */}
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-9 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
      >
        Try again
      </button>
    </div>
  );
}
