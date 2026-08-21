import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPlans, createPlan } from "@/lib/saas/plans";
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
    const plan = await createPlan({
      name: String(body.name ?? ""),
      slug: String(body.slug ?? ""),
      monthlyPrice: Number(body.monthlyPrice),
      annualPrice: Number(body.annualPrice),
      currency: typeof body.currency === "string" ? body.currency : "USD",
      trialDays: body.trialDays != null ? Number(body.trialDays) : 14,
      maxProperties: body.maxProperties != null ? Number(body.maxProperties) : null,
      maxUsers: body.maxUsers != null ? Number(body.maxUsers) : null,
      maxBookings: body.maxBookings != null ? Number(body.maxBookings) : null,
      storageGb: body.storageGb != null ? Number(body.storageGb) : null,
      features: typeof body.features === "object" && body.features !== null ? (body.features as Record<string, unknown>) : undefined,
      isActive: body.isActive !== false,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "plan.created", entity: "plan", entityId: plan.id, detail: plan.slug, ip: clientIp(req) });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
