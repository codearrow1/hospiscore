import Link from "next/link";

const DEFAULT_OPTIONS = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
];

export function rangeToFrom(range: string | undefined): string | undefined {
  const days = Number(range);
  if (!range || !Number.isFinite(days) || days <= 0) return undefined;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function RangeTabs({
  basePath,
  current,
  options = DEFAULT_OPTIONS,
}: {
  basePath: string;
  current?: string;
  options?: { value: string; label: string }[];
}) {
  const cur = current ?? "30";
  return (
    <nav aria-label="Date range" className="inline-flex rounded-xl border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {options.map((o) => {
        const active = o.value === cur;
        return (
          <Link
            key={o.value}
            href={`${basePath}?range=${o.value}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-indigo-600 text-white"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
