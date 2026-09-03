import { NextResponse } from "next/server";
import { searchProperties } from "@/lib/resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=lisbon
 * Returns featured search results (signals already scored server-side).
 *
 * `mode` reflects the TRUE provenance of the returned results (result-level
 * `isLive`), NOT merely whether a Google key is configured. If live lookup
 * falls back to the seeded demo dataset (provider outage, missing key), mode
 * is "demo" so the UI badge never claims live data over demo results.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);

  const results = await searchProperties(q);
  const mode: "live" | "demo" = results.length > 0 && results.some((r) => r.isLive) ? "live" : "demo";

  return NextResponse.json({
    mode,
    query: q,
    count: results.length,
    results,
  });
}