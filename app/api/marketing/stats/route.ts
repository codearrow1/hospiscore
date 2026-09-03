import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/marketing/guard";
import { hasCapability } from "@/lib/marketing/roles";
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

  const canSeeAll = hasCapability(guard.user, "leads.manage");
  // Mirrors GET /api/marketing/leads: non-managers (sales reps/analysts) are
  // scoped to their own book of business for metrics, and never receive the
  // full team directory (only their own record).
  const metricsPromise = canSeeAll
    ? dashboardMetrics()
    : dashboardMetrics(undefined, { ownerEmail: guard.user.email });
  const [metrics, campaigns, views, users] = await Promise.all([
    metricsPromise,
    campaignStats(),
    allViews(),
    canSeeAll ? listUsers() : Promise.resolve([{ id: guard.user.id, name: guard.user.name, email: guard.user.email, role: guard.user.role ?? null, createdAt: "" }]),
  ]);
  const topPagesList = await topPages(views, 8);

  return NextResponse.json({ metrics, campaigns, users, topPages: topPagesList });
}