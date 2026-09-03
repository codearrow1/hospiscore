import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update a flag: toggle enabled or adjust scope/rollout fields. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }
  if (body.percentage != null) {
    const pct = Number(body.percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return NextResponse.json({ error: "percentage 0-100" }, { status: 400 });
  }
  try {
    const before = await prisma.featureFlag.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    const flag = await prisma.featureFlag.update({
      where: { id },
      data: {
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        percentage: body.percentage !== undefined ? (body.percentage == null ? null : Number(body.percentage)) : undefined,
        isBeta: typeof body.isBeta === "boolean" ? body.isBeta : undefined,
        planId: typeof body.planId === "string" ? body.planId || null : undefined,
        organizationId: typeof body.organizationId === "string" ? body.organizationId || null : undefined,
        propertyId: typeof body.propertyId === "string" ? body.propertyId || null : undefined,
        country: typeof body.country === "string" ? body.country.toUpperCase() || null : undefined,
      },
    });
    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "feature_flag.updated",
      entity: "feature_flag",
      entityId: id,
      detail: `${flag.key} enabled=${flag.enabled}`,
      ip: clientIp(req),
      before: { enabled: before.enabled },
      after: { enabled: flag.enabled },
    });
    return NextResponse.json({ flag });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

/** Delete a flag — audited, irreversible. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const { id } = await params;
  try {
    const before = await prisma.featureFlag.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    await prisma.featureFlag.delete({ where: { id } });
    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "feature_flag.deleted",
      entity: "feature_flag",
      entityId: id,
      detail: `deleted ${before.key} (was ${before.enabled ? "ON" : "OFF"})`,
      ip: clientIp(req),
      before: { key: before.key, enabled: before.enabled },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 });
  }
}
