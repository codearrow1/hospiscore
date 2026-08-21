import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCoupons, createCoupon } from "@/lib/saas/coupons";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "MARKETING_VIEW")) return NextResponse.json({ error: "MARKETING_VIEW required" }, { status: 403 });
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  const { items, total } = await listCoupons({ activeOnly });
  return NextResponse.json({ coupons: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "MARKETING_MANAGE")) return NextResponse.json({ error: "MARKETING_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const coupon = await createCoupon({
      code: typeof body.code === "string" && body.code ? body.code : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      type: body.type as never,
      value: Number(body.value),
      duration: body.duration as never,
      months: body.months != null ? Number(body.months) : null,
      maxRedemptions: body.maxRedemptions != null ? Number(body.maxRedemptions) : null,
      expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "coupon.created", entity: "coupon", entityId: coupon.id, detail: `${coupon.code} ${coupon.type} ${coupon.value}`, ip: clientIp(req) });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
