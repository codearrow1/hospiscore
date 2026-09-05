/**
 * Shared denial UI for marketing-admin pages whose capability gate fails.
 * Server component — mirrors the layout's "restricted" style so every
 * restricted surface looks the same.
 */

import Header from "@/components/Header";

export function restrictedPanel(title: string, hint: string) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{hint}</p>
        </div>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiOS · Hospitality OS
      </footer>
    </div>
  );
}