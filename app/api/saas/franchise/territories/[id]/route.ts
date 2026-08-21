import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updateTerritoryStatus } from "@/lib/saas/franchise";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_MANAGE")) return NextResponse.json({ error: "FRANCHISE_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = String(body.status ?? "");
  if (status !== "active" && status !== "inactive") return NextResponse.json({ error: "status must be active|inactive" }, { status: 400 });
  try {
    const t = await updateTerritoryStatus(id, status);
    await writeSaasAudit({ byEmail: guard.user.email, action: `territory.${status}`, entity: "territory", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ territory: t });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
