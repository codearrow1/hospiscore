import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCountryPrices } from "@/lib/saas/pricingSync";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/plan-prices — the complete global pricing catalog
 * (every active plan × every configured market) with optional filters:
 *   ?planId=&country=&currency=
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_VIEW")) return NextResponse.json({ error: "PLAN_VIEW required" }, { status: 403 });
  const planId = req.nextUrl.searchParams.get("planId") || undefined;
  const country = req.nextUrl.searchParams.get("country") || undefined;
  const currency = req.nextUrl.searchParams.get("currency") || undefined;
  const prices = await listCountryPrices({ planId, country, currency });
  return NextResponse.json({
    prices,
    countries: SEED_COUNTRIES.map((c) => ({ code: c.code, name: c.name, currency: c.currency })),
    total: prices.length,
  });
}
