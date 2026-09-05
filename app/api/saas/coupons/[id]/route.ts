import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updateCouponStatus } from "@/lib/saas/coupons";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "MARKETING_MANAGE")) return NextResponse.json({ error: "MARKETING_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive boolean required" }, { status: 400 });
  try {
    const coupon = await updateCouponStatus(id, body.isActive);
    await writeSaasAudit({ byEmail: guard.user.email, action: body.isActive ? "coupon.activated" : "coupon.archived", entity: "coupon", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ coupon });
  } catch {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
}
