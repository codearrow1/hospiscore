import { NextResponse } from "next/server";
import { searchProperties } from "@/lib/resolver";
import { dataMode } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=lisbon
 * Returns featured search results (signals already scored server-side).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const results = await searchProperties(q);

  return NextResponse.json({
    mode: dataMode(),
    query: q,
    count: results.length,
    results,
  });
}