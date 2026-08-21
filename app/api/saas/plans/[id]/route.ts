import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getPlan, updatePlan, deletePlan } from "@/lib/saas/plans";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_VIEW")) return NextResponse.json({ error: "PLAN_VIEW required" }, { status: 403 });
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_MANAGE")) return NextResponse.json({ error: "PLAN_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.slug !== undefined) patch.slug = String(body.slug);
  if (body.monthlyPrice !== undefined) patch.monthlyPrice = Number(body.monthlyPrice);
  if (body.annualPrice !== undefined) patch.annualPrice = Number(body.annualPrice);
  if (body.currency !== undefined) patch.currency = String(body.currency);
  if (body.trialDays !== undefined) patch.trialDays = Number(body.trialDays);
  if (body.maxProperties !== undefined) patch.maxProperties = body.maxProperties == null ? null : Number(body.maxProperties);
  if (body.maxUsers !== undefined) patch.maxUsers = body.maxUsers == null ? null : Number(body.maxUsers);
  if (body.maxBookings !== undefined) patch.maxBookings = body.maxBookings == null ? null : Number(body.maxBookings);
  if (body.storageGb !== undefined) patch.storageGb = body.storageGb == null ? null : Number(body.storageGb);
  if (body.features !== undefined) patch.features = body.features as Record<string, unknown>;
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  try {
    const before = await getPlan(id);
    const plan = await updatePlan(id, patch as never);
    await writeSaasAudit({ byEmail: guard.user.email, action: "plan.updated", entity: "plan", entityId: id, detail: Object.keys(patch).join(","), ip: clientIp(req), before: { slug: before?.slug }, after: { slug: plan.slug } });
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_MANAGE")) return NextResponse.json({ error: "PLAN_MANAGE required" }, { status: 403 });
  const { id } = await params;
  try {
    const plan = await getPlan(id);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    await deletePlan(id);
    await writeSaasAudit({ byEmail: guard.user.email, action: "plan.deleted", entity: "plan", entityId: id, detail: plan.slug, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 });
  }
}
