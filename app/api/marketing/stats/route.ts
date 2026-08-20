import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/marketing/guard";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { dashboardMetrics } from "@/lib/marketing/metrics";
import { campaignStats } from "@/lib/marketing/campaigns";
import { listUsers } from "@/lib/marketing/users";
import { topPages, allViews } from "@/lib/marketing/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/stats — one payload for the dashboard + analytics:
 * KPIs, funnel, trend, distributions, campaign roll-ups, recent events,
 * top pages by views, and the team directory for assignment selects.
 */
export async function GET() {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) return guard.response;
  await ensureMarketingStore();

  const [metrics, campaigns, users, views] = await Promise.all([
    dashboardMetrics(),
    campaignStats(),
    listUsers(),
    allViews(),
  ]);
  const topPagesList = await topPages(views, 8);

  return NextResponse.json({ metrics, campaigns, users, topPages: topPagesList });
}