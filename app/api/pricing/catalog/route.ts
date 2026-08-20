import { NextResponse } from "next/server";
import { buildPricingSnapshot } from "@/lib/pricing/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pricing/catalog
 *
 * Public, display-only pricing catalog: countries, plan catalog, feature
 * matrix, currency metadata, gateway labels and the current pricing
 * profiles. Prices served here are for display; the authoritative price for
 * a subscription is always resolved server-side at checkout.
 */
export async function GET() {
  const snapshot = await buildPricingSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60",
    },
  });
}