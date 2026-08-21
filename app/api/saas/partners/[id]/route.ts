import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updatePartnerStatus } from "@/lib/saas/partners";
import type { PartnerStatus } from "@/lib/saas/partners";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_MANAGE")) return NextResponse.json({ error: "PARTNER_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const partner = await updatePartnerStatus(id, String(body.status ?? "") as PartnerStatus);
    await writeSaasAudit({ byEmail: guard.user.email, action: `partner.${body.status}`, entity: "partner", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ partner });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
