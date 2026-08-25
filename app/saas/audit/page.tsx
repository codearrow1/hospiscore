import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listAuditLogs } from "@/lib/saas/audit";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import AuditFilterBar from "@/components/saas/AuditFilterBar";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Human phrasing for record types stored as machine keys. */
const TARGET_LABELS: Record<string, string> = {
  organization: "Organization",
  subscription: "Subscription",
  invoice: "Invoice",
  payment: "Payment",
  plan: "Plan",
  country_price: "Country price",
  support_ticket: "Support ticket",
  payout: "Payout",
  commission: "Commission",
  territory: "Territory",
  change_request: "Change request",
};

function targetLabel(t: string): string {
  return TARGET_LABELS[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

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
      <p className="text-sm text-zinc-500">{total} entries — immutable, append-only. Every sensitive action: plan/price change, subscription cancellation, refund, payout, commission, territory assignment.</p>
      <AuditFilterBar action={action ?? ""} targetType={targetType ?? ""} />
      {items.length === 0 ? <SectionCard><EmptyState title="No audit entries" /></SectionCard> : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((l) => (
              <li key={l.id} className="rounded-xl border border-line bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{l.action}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-400">{formatDate(l.timestamp)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-500">{l.actorEmail}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {targetLabel(l.targetType)}
                  {l.ip ? ` · ${l.ip}` : ""}
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block dark:bg-zinc-900 dark:border-zinc-800">
            <table className="w-full text-start text-sm">
              <thead><tr className="text-xs uppercase text-zinc-400"><th scope="col" className="px-2 py-1">Time</th><th scope="col" className="px-2 py-1">Actor</th><th scope="col" className="px-2 py-1">Action</th><th scope="col" className="px-2 py-1">Target type</th><th scope="col" className="px-2 py-1">Reference</th><th scope="col" className="px-2 py-1">Request</th></tr></thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-2 py-1 text-xs">{formatDateTime(l.timestamp)}</td>
                    <td className="px-2 py-1">{l.actorEmail}</td>
                    <td className="px-2 py-1 font-mono text-xs">{l.action}</td>
                    <td className="px-2 py-1">{targetLabel(l.targetType)}</td>
                    <td className="px-2 py-1 font-mono text-xs">{l.targetId?.slice(0, 6) || "—"}</td>
                    <td className="px-2 py-1 font-mono text-[10px]">{l.requestId?.slice(0, 8) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
