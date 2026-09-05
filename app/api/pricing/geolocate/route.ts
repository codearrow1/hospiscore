import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveCountry } from "@/lib/pricing/engine";
import { BILLING_COUNTRY_COOKIE } from "@/lib/pricing/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pricing/geolocate
 *
 * Detects the visitor's country from CDN/proxy Geo-IP headers, preferring a
 * manually-selected billing country cookie. Returns a CountryResolution
 * (country, name, flag, currency, source) — never prices.
 */
export async function GET(request: Request) {
  const store = await cookies();
  const cookieValue = store.get(BILLING_COUNTRY_COOKIE)?.value;

  const resolution = resolveCountry(request.headers, cookieValue);

  return NextResponse.json(resolution, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}