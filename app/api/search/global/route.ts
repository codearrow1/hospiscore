import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { globalSearch } from "@/lib/saas/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  // any authenticated with CUSTOMER_VIEW or MARKETING_VIEW can search; use broad check
  if (!hasSaasPerm(guard.user, "CUSTOMER_VIEW") && !hasSaasPerm(guard.user, "MARKETING_VIEW") && !hasSaasPerm(guard.user, "AUDIT_VIEW")) {
    return NextResponse.json({ error: "Search requires CUSTOMER_VIEW or MARKETING_VIEW" }, { status: 403 });
  }
  const q = req.nextUrl.searchParams.get("q") || "";
  const results = await globalSearch(q);
  return NextResponse.json({ results });
}
