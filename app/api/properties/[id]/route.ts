import { NextResponse } from "next/server";
import { resolvePropertyById } from "@/lib/resolver";
import { computeScore } from "@/lib/scoring";
import { dataMode } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/properties/:id
 * `id` is either a demo slug or `place:<googlePlaceId>`.
 * Returns the property + its full score breakdown for live-property pages.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const property = await resolvePropertyById(decodeURIComponent(id));

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const result = computeScore(property.signals);
  return NextResponse.json({
    mode: dataMode(),
    property,
    score: result,
  });
}