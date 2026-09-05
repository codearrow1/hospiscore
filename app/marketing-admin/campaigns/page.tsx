import { requireCapability } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { campaignStats, listCampaigns } from "@/lib/marketing/campaigns";
import CampaignsManager from "@/components/marketing-admin/CampaignsManager";
import type { CampaignRow } from "@/components/marketing-admin/CampaignsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CampaignsPage() {
  const guard = await requireCapability("campaigns.manage");
  if (!guard.ok) {
    return restrictedPanel("Campaigns", "You need campaigns.manage permission to manage campaigns.");
  }
  await ensureMarketingStore();

  const [stats, campaigns] = await Promise.all([campaignStats(), listCampaigns()]);
  const configById = new Map(campaigns.map((c) => [c.id, c]));
  const rows: CampaignRow[] = stats.map((c) => {
    const cfg = configById.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      channel: cfg?.channel ?? "other",
      audience: cfg?.audience,
      country: cfg?.country,
      landingPage: cfg?.landingPage,
      utmCampaign: cfg?.utmCampaign,
      startAt: cfg?.startAt,
      endAt: cfg?.endAt,
      budget: cfg?.budget,
      leads: c.leads,
      demos: c.demos,
      trials: c.trials,
      conversions: c.conversions,
      pipelineValue: c.pipelineValue,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Track paid and organic acquisition, with real UTM attribution into the
          lead pipeline.
        </p>
      </div>
      <CampaignsManager campaigns={rows} />
    </div>
  );
}