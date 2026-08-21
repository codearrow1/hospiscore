import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getUsage, recordUsage } from "@/lib/saas/usage";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "USAGE_VIEW")) return NextResponse.json({ error: "USAGE_VIEW required" }, { status: 403 });
  const orgId = req.nextUrl.searchParams.get("organizationId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  try {
    const snapshots = await getUsage(orgId);
    return NextResponse.json({ usage: snapshots });
  } catch (e) {
    if (e instanceof Error && e.message === "Organization not found") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const organizationId = String(body.organizationId ?? "");
  const metric = String(body.metric ?? "");
  const quantity = Number(body.quantity ?? 1);
  if (!organizationId || !metric) return NextResponse.json({ error: "organizationId and metric required" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: "quantity must be >0" }, { status: 400 });
  try {
    const rec = await recordUsage(organizationId, metric as never, quantity);
    await writeSaasAudit({ byEmail: guard.user.email, action: "usage.recorded", entity: "usage", entityId: rec.id, detail: `${metric} +${quantity}`, ip: clientIp(req) });
    return NextResponse.json({ record: rec }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Record failed" }, { status: 400 });
  }
}
