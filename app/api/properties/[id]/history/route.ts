import { NextResponse } from "next/server";
import { getScoreStore } from "@/lib/scoreHistory";

export const runtime = "nodejs";

/** GET /api/properties/:id/history — stored score snapshots (oldest → newest). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const history = await getScoreStore().history(decodeURIComponent(id));
  return NextResponse.json({ propertyId: id, count: history.length, history });
}