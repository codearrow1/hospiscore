"use client";

import { useEffect } from "react";

export default function SubadminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[subadmin] route error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-sm font-bold text-red-600 dark:text-red-400">Something went wrong</p>
      <p className="mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
        The growth workspace hit an unexpected error. Your data is safe — retry, and if it persists
        contact support with the reference below.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          ref: {error.digest}
        </p>
      )}
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
