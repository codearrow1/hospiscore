import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updatePartnerStatus, PARTNER_STATUSES } from "@/lib/saas/partners";
import type { PartnerStatus } from "@/lib/saas/partners";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_VIEW")) return NextResponse.json({ error: "PARTNER_VIEW required" }, { status: 403 });
  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  return NextResponse.json({ partner });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_MANAGE")) return NextResponse.json({ error: "PARTNER_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const statusStr = String(body.status ?? "");
    if (!statusStr || !PARTNER_STATUSES.includes(statusStr as PartnerStatus)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${PARTNER_STATUSES.join(", ")}` }, { status: 400 });
    }
    const partner = await updatePartnerStatus(id, statusStr as PartnerStatus);
    await writeSaasAudit({ byEmail: guard.user.email, action: `partner.status_changed`, entity: "partner", entityId: id, detail: statusStr, ip: clientIp(req) });
    return NextResponse.json({ partner });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
