import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { revenueByCountry, mrrByPlan, acquisitionBySource, churnCohort } from "@/lib/saas/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_VIEW")) return NextResponse.json({ error: "CUSTOMER_VIEW required" }, { status: 403 });
  const drilldown = req.nextUrl.searchParams.get("drilldown") ?? "all";
  const months = Math.min(Math.max(Number(req.nextUrl.searchParams.get("months")) || 6, 1), 24);
  const [country, plan, source, churn] = await Promise.all([
    drilldown === "all" || drilldown === "country" ? revenueByCountry() : [],
    drilldown === "all" || drilldown === "plan" ? mrrByPlan() : [],
    drilldown === "all" || drilldown === "source" ? acquisitionBySource() : [],
    drilldown === "all" || drilldown === "churn" ? churnCohort(months) : [],
  ]);
  return NextResponse.json({ country, plan, source, churn });
}
