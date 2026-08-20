import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listLeads } from "@/lib/marketing/leads";
import PipelineBoard from "@/components/marketing-admin/PipelineBoard";
import type { PipelineLead } from "@/components/marketing-admin/PipelineBoard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PipelinePage() {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) {
    return restrictedPanel("Pipeline", "You need leads.read permission to view the sales pipeline.");
  }
  await ensureMarketingStore();

  const leads = await listLeads();
  const rows: PipelineLead[] = leads
    .filter((l) => !l.convertedCustomerId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      ownerEmail: l.ownerEmail,
      estimatedValue: l.estimatedValue,
      stage: l.stage,
      nextFollowUpAt: l.nextFollowUpAt,
    }));

  const total = rows.reduce((sum, l) => sum + l.estimatedValue, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {rows.length} open deals · {total > 0 ? `$${total.toLocaleString()} estimated pipeline value` : "no value captured yet"} — use the select on a card to advance or re-open a deal.
        </p>
      </div>
      <PipelineBoard leads={rows} />
    </div>
  );
}