import { NextRequest, NextResponse } from "next/server";
import { requireCapability } from "@/lib/marketing/guard";
import { hasCapability } from "@/lib/marketing/roles";
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
  const canSeeAll = hasCapability(guard.user, "leads.manage");
  // Mirrors GET /api/marketing/leads: non-managers (sales reps) are hard-scoped
  // to their own assignments; an ?owner= param cannot widen the view/export.
  const owner = canSeeAll ? (sp.get("owner") ?? undefined) : guard.user.email;
  const filtered = filterLeads(leads, {
    q: sp.get("q") ?? undefined,
    stage: isLeadStage(sp.get("stage") ?? "") ? (sp.get("stage") as never) : "all",
    source: (sp.get("source") ?? "all") as never,
    country: sp.get("country") ?? undefined,
    plan: sp.get("plan") ?? undefined,
    owner,
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