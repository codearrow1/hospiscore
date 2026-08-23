import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPlans, createPlan, coerceNumber, coerceOptionalNumber } from "@/lib/saas/plans";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_VIEW")) return NextResponse.json({ error: "PLAN_VIEW required" }, { status: 403 });
  const plans = await listPlans();
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_MANAGE")) return NextResponse.json({ error: "PLAN_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const reqNum = (field: string, v: unknown, fallback?: number): number => {
      if ((v === null || v === undefined || v === "") && fallback !== undefined) return fallback;
      const r = coerceNumber(field, v);
      if (!r.ok) throw new Error(r.error);
      return r.value;
    };
    const optNum = (field: string, v: unknown): number | null => {
      const r = coerceOptionalNumber(field, v);
      if (!r.ok) throw new Error(r.error);
      return r.value;
    };
    const plan = await createPlan({
      name: String(body.name ?? ""),
      slug: String(body.slug ?? ""),
      monthlyPrice: reqNum("monthlyPrice", body.monthlyPrice),
      annualPrice: reqNum("annualPrice", body.annualPrice),
      currency: typeof body.currency === "string" ? body.currency : "USD",
      trialDays: reqNum("trialDays", body.trialDays, 14),
      maxProperties: optNum("maxProperties", body.maxProperties),
      maxUsers: optNum("maxUsers", body.maxUsers),
      maxBookings: optNum("maxBookings", body.maxBookings),
      storageGb: optNum("storageGb", body.storageGb),
      features: typeof body.features === "object" && body.features !== null ? (body.features as Record<string, unknown>) : undefined,
      isActive: body.isActive !== false,
      tagline: typeof body.tagline === "string" ? body.tagline : undefined,
      descriptor: typeof body.descriptor === "string" ? body.descriptor : undefined,
      roomMin: optNum("roomMin", body.roomMin),
      roomMax: optNum("roomMax", body.roomMax),
      adminLimit: optNum("adminLimit", body.adminLimit),
      staffLimit: optNum("staffLimit", body.staffLimit),
      featured: body.featured === true,
      displayOrder: reqNum("displayOrder", body.displayOrder, 0),
      isCustomPrice: body.isCustomPrice === true,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "plan.created", entity: "plan", entityId: plan.id, detail: plan.slug, ip: clientIp(req) });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
