import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listAffiliates, createAffiliate } from "@/lib/saas/affiliates";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const { items, total } = await listAffiliates({ status, q });
  return NextResponse.json({ affiliates: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  // Allow anyone to apply? For SaaS admin, need AFFILIATE_MANAGE to create; but public apply via same endpoint with no auth? For now require MANAGE, portal apply will use separate /api/affiliate/apply
  if (!hasSaasPerm(guard.user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "AFFILIATE_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const aff = await createAffiliate({
      name: String(body.name ?? ""),
      businessName: typeof body.businessName === "string" ? body.businessName : undefined,
      email: String(body.email ?? ""),
      phone: typeof body.phone === "string" ? body.phone : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      audience: typeof body.audience === "string" ? body.audience : undefined,
      promotionMethod: typeof body.promotionMethod === "string" ? body.promotionMethod : undefined,
      tier: typeof body.tier === "string" ? body.tier : "standard",
      commissionModel: typeof body.commissionModel === "string" ? body.commissionModel : "percent_mrr_12",
      commissionValue: body.commissionValue != null ? Number(body.commissionValue) : 2000,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "affiliate.created", entity: "affiliate", entityId: aff.id, detail: aff.email, ip: clientIp(req) });
    return NextResponse.json({ affiliate: aff }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
