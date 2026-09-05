import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listAudit } from "@/lib/marketing/audit";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AuditPage() {
  const guard = await requireCapability("audit.read");
  if (!guard.ok) {
    return restrictedPanel("Audit log", "You need audit.read permission to view the audit log.");
  }
  await ensureMarketingStore();

  const entries = await listAudit(500);

  const byAction = new Map<string, number>();
  for (const e of entries) byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1);
  const topActions = Array.from(byAction.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Who changed what, when. Every lead, demo, campaign and form mutation
          is recorded here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total events" value={entries.length} />
        {topActions.slice(0, 3).map(([action, count]) => (
          <StatTile key={action} label={action} value={count} />
        ))}
      </div>

      <SectionCard title="Recent activity">
        {entries.length === 0 ? (
          <EmptyState title="No changes recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="pb-2 pr-3 font-semibold">When</th>
                  <th className="pb-2 pr-3 font-semibold">Who</th>
                  <th className="pb-2 pr-3 font-semibold">Action</th>
                  <th className="pb-2 pr-3 font-semibold">Entity</th>
                  <th className="pb-2 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {new Date(e.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-200">{e.byEmail ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{e.entity}{e.entityId ? `:${e.entityId.slice(0, 8)}` : ""}</td>
                    <td className="max-w-xs truncate py-2 text-zinc-600 dark:text-zinc-300">{e.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-400">{label.replace(/_/g, " ")}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}