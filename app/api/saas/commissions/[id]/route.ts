import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updateCommissionStatus, reverseCommission } from "@/lib/saas/commissions";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_APPROVE")) return NextResponse.json({ error: "AFFILIATE_APPROVE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = String(body.status ?? "");
  const action = String(body.action ?? "");
  try {
    let res;
    if (action === "reverse") {
      res = await reverseCommission(id);
      await writeSaasAudit({ byEmail: guard.user.email, action: "commission.reversed", entity: "commission", entityId: id, ip: clientIp(req) });
    } else {
      res = await updateCommissionStatus(id, status as never);
      await writeSaasAudit({ byEmail: guard.user.email, action: `commission.${status}`, entity: "commission", entityId: id, ip: clientIp(req) });
    }
    return NextResponse.json({ commission: res });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
