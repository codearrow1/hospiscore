import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin, listLeads, filterLeads, leadsToCsv } from "@/lib/leads";
import { isLeadStatus } from "@/lib/accountTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leads/export?source=demo|report&status=new|contacted|won|closed
 *
 * Downloads the current leads (honoring the same filters as /account/leads) as
 * a CSV attachment. Admin-only: 401 when signed out, 403 for non-admins.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const sourceParam = url.searchParams.get("source");
  const source: "all" | "demo" | "report" =
    sourceParam === "demo" || sourceParam === "report" ? sourceParam : "all";
  const statusParam = url.searchParams.get("status");
  const status = isLeadStatus(statusParam) ? statusParam : "all";

  const snapshot = await listLeads();
  const { demo, report } = filterLeads(snapshot, source, status);
  const rows = [...demo, ...report];

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(leadsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
