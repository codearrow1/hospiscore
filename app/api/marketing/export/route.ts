import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/marketing/guard";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listLeads, filterLeads, leadToCsvRows } from "@/lib/marketing/leads";
import { isLeadStage } from "@/lib/marketing/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marketing/export?q=&stage=&source=&country=&plan=&owner=&band= */
export async function GET(req: NextRequest) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) return guard.response;
  await ensureMarketingStore();

  const sp = req.nextUrl.searchParams;
  const leads = await listLeads();
  const filtered = filterLeads(leads, {
    q: sp.get("q") ?? undefined,
    stage: isLeadStage(sp.get("stage") ?? "") ? (sp.get("stage") as never) : "all",
    source: (sp.get("source") ?? "all") as never,
    country: sp.get("country") ?? undefined,
    plan: sp.get("plan") ?? undefined,
    owner: sp.get("owner") ?? undefined,
    band: ((sp.get("band") ?? "all") as never) || "all",
    minScore: sp.get("minScore") ? Number(sp.get("minScore")) : undefined,
  });

  const csv = leadToCsvRows(filtered);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketing-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}