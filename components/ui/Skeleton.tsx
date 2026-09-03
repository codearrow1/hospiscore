export function SkeletonLine({ className = "h-4 w-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <SkeletonLine className="h-3 w-20" />
      <SkeletonLine className="mt-3 h-7 w-28" />
      <SkeletonLine className="mt-2 h-3 w-24" />
    </div>
  );
}

export function KpiGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line"
      role="status"
      aria-label="Loading data"
    >
      <div className="flex gap-4 border-b border-line bg-surface-subtle px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-[180px]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
