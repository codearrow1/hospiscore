import { NextRequest, NextResponse } from "next/server";
import { secretsMatch } from "@/lib/saas/cronAuth";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { billUsagePeriod } from "@/lib/saas/usageBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/cron/usage — CRON_SECRET schedulers only (session callers
 * POST). Invoices last month's overage usage; inert until usage_overage_rates
 * is configured in SystemSettings.
 */
async function handle(req: NextRequest, allowSession: boolean) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && headerSecret && secretsMatch(cronSecret, headerSecret)) {
    return NextResponse.json({ ok: true, ...(await billUsagePeriod()) });
  }
  if (!allowSession) {
    return NextResponse.json({ error: "X-Cron-Secret required for GET" }, { status: 401 });
  }
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  const period = req.nextUrl.searchParams.get("period") ?? undefined;
  if (period && !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...(await billUsagePeriod({ period })) });
}

export async function GET(req: NextRequest) {
  return handle(req, false);
}

export async function POST(req: NextRequest) {
  return handle(req, true);
}
