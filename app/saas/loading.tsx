import { KpiGridSkeleton } from "@/components/ui/Skeleton";

export default function SaasLoading() {
  return (
    <div aria-busy="true" aria-label="Loading control plane">
      <div className="mb-6">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <KpiGridSkeleton count={8} />
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
    </div>
  );
}
