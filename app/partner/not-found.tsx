import Link from "next/link";

export default function PartnerNotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-4xl font-bold text-zinc-200 dark:text-zinc-800">404</p>
      <h1 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-50">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        This partner portal page does not exist.
      </p>
      <Link
        href="/partner"
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
