import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getPlan, updatePlan, archivePlan } from "@/lib/saas/plans";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { validateCountryPriceEntries, applyCountryPrices } from "@/lib/saas/pricingSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_VIEW")) return NextResponse.json({ error: "PLAN_VIEW required" }, { status: 403 });
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
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
  if (body.description !== undefined) patch.description = body.description == null ? null : String(body.description);
  if (body.tagline !== undefined) patch.tagline = body.tagline == null ? null : String(body.tagline);
  if (body.descriptor !== undefined) patch.descriptor = body.descriptor == null ? null : String(body.descriptor);
  if (body.roomMin !== undefined) patch.roomMin = body.roomMin == null ? null : Number(body.roomMin);
  if (body.roomMax !== undefined) patch.roomMax = body.roomMax == null ? null : Number(body.roomMax);
  if (body.adminLimit !== undefined) patch.adminLimit = body.adminLimit == null ? null : Number(body.adminLimit);
  if (body.staffLimit !== undefined) patch.staffLimit = body.staffLimit == null ? null : Number(body.staffLimit);
  if (body.featured !== undefined) patch.featured = Boolean(body.featured);
  if (body.displayOrder !== undefined) patch.displayOrder = Number(body.displayOrder);
  if (body.isCustomPrice !== undefined) patch.isCustomPrice = Boolean(body.isCustomPrice);
  try {
    const before = await getPlan(id);
    const plan = await updatePlan(id, patch as never);
    // SaaS → Marketing automatic synchronization: country price edits flow
    // through the canonical applier (PlanCountryPrice rows + US billing
    // invariant + storefront PricingDoc mirror) in one deterministic path.
    let syncedCountries: string[] = [];
    if (body.countryPrices !== undefined) {
      const v = validateCountryPriceEntries(body.countryPrices);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 });
      const applied = await applyCountryPrices(id, v.value, guard.user.email);
      syncedCountries = applied.applied.map((e) => e.country);
      if (applied.billingUpdated) {
        // US entry moved the billing cents — refetch for the response.
      }
    }
    const finalPlan = await getPlan(id);
    await writeSaasAudit({ byEmail: guard.user.email, action: "plan.updated", entity: "plan", entityId: id, detail: [Object.keys(patch).join(","), ...(syncedCountries.length ? [`countryPrices:${syncedCountries.join(",")}`] : [])].filter(Boolean).join(" | "), ip: clientIp(req), before: { slug: before?.slug }, after: { slug: plan.slug } });
    return NextResponse.json({ plan: finalPlan ?? plan });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PLAN_MANAGE")) return NextResponse.json({ error: "PLAN_MANAGE required" }, { status: 403 });
  const { id } = await params;
  try {
    const plan = await getPlan(id);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    // Archive, never delete: subscriptions/invoices keep referencing this id.
    await archivePlan(id);
    await writeSaasAudit({ byEmail: guard.user.email, action: "plan.archived", entity: "plan", entityId: id, detail: plan.slug, ip: clientIp(req), before: { isActive: plan.isActive }, after: { isActive: false } });
    return NextResponse.json({ ok: true, archived: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Archive failed" }, { status: 400 });
  }
}
