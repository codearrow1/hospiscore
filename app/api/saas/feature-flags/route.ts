import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE") && !hasSaasPerm(guard.user, "PLAN_VIEW")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ flags });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const key = String(body.key ?? "").trim();
  if (!key || key.length < 2) return NextResponse.json({ error: "key required" }, { status: 400 });
  const percentage = body.percentage != null ? Number(body.percentage) : null;
  if (percentage != null && (percentage < 0 || percentage > 100)) return NextResponse.json({ error: "percentage 0-100" }, { status: 400 });
  try {
    const flag = await prisma.featureFlag.create({
      data: {
        key,
        enabled: Boolean(body.enabled),
        planId: typeof body.planId === "string" && body.planId ? body.planId : null,
        organizationId: typeof body.organizationId === "string" && body.organizationId ? body.organizationId : null,
        propertyId: typeof body.propertyId === "string" && body.propertyId ? body.propertyId : null,
        country: typeof body.country === "string" && body.country ? String(body.country).toUpperCase() : null,
        percentage,
        isBeta: Boolean(body.isBeta),
      },
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "feature_flag.created", entity: "feature_flag", entityId: flag.id, detail: `${key} enabled=${flag.enabled}`, ip: clientIp(req) });
    return NextResponse.json({ flag }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
