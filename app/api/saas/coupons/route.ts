import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCoupons, createCoupon } from "@/lib/saas/coupons";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "MARKETING_VIEW")) return NextResponse.json({ error: "MARKETING_VIEW required" }, { status: 403 });
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  const { items, total } = await listCoupons({ activeOnly });
  return NextResponse.json({ coupons: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "MARKETING_MANAGE")) return NextResponse.json({ error: "MARKETING_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const num = (field: string, v: unknown): number => {
      if (v === null || v === undefined || v === "") throw new Error(`${field} is required`);
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error(`${field} must be a finite number`);
      return n;
    };
    const optNum = (field: string, v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      return num(field, v);
    };
    const coupon = await createCoupon({
      code: typeof body.code === "string" && body.code ? body.code : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      type: body.type as never,
      value: num("value", body.value),
      duration: body.duration as never,
      months: optNum("months", body.months),
      maxRedemptions: optNum("maxRedemptions", body.maxRedemptions),
      expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "coupon.created", entity: "coupon", entityId: coupon.id, detail: `${coupon.code} ${coupon.type} ${coupon.value}`, ip: clientIp(req) });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
