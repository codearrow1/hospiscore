import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/marketing/guard";
import { listAudit } from "@/lib/marketing/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marketing/audit?limit= */
export async function GET(req: Request) {
  const guard = await requireCapability("audit.read");
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);
  const entries = await listAudit(limit);
  return NextResponse.json({ entries });
}