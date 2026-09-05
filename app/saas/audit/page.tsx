import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listAuditLogs } from "@/lib/saas/audit";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AuditPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Audit", "Platform access required.");
  if (!hasSaasPerm(guard.user, "AUDIT_VIEW")) return restrictedPanel("Audit", "AUDIT_VIEW required.");
  const sp = (await searchParams) ?? {};
  const action = sp.action || undefined;
  const targetType = sp.targetType || undefined;
  const { items, total } = await listAuditLogs({ action, targetType, take: 100 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <p className="text-sm text-zinc-500">{total} entries — immutable, append-only. Every sensitive action: plan/price change, sub cancel, refund, payout, commission, territory assignment.</p>
      <form className="flex gap-2">
        <input name="action" defaultValue={action ?? ""} placeholder="Filter action (e.g. org.created)" className="rounded-xl border bg-white px-3 py-1 text-sm dark:bg-zinc-900 dark:border-zinc-700" />
        <input name="targetType" defaultValue={targetType ?? ""} placeholder="Target type" className="rounded-xl border bg-white px-3 py-1 text-sm dark:bg-zinc-900 dark:border-zinc-700" />
        <button type="submit" className="rounded-xl border bg-white px-3 py-1 text-sm dark:bg-zinc-900">Filter</button>
      </form>
      {items.length === 0 ? <SectionCard><EmptyState title="No audit entries" /></SectionCard> : (
        <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-zinc-400"><th className="px-2 py-1">Time</th><th className="px-2 py-1">Actor</th><th className="px-2 py-1">Action</th><th className="px-2 py-1">Target</th><th className="px-2 py-1">IP</th><th className="px-2 py-1">Request</th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-2 py-1 text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="px-2 py-1">{l.actorEmail}</td>
                  <td className="px-2 py-1 font-mono text-xs">{l.action}</td>
                  <td className="px-2 py-1">{l.targetType}{l.targetId ? `:${l.targetId.slice(0,6)}` : ""}</td>
                  <td className="px-2 py-1 text-xs">{l.ip || "—"}</td>
                  <td className="px-2 py-1 font-mono text-[10px]">{l.requestId?.slice(0,8) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
