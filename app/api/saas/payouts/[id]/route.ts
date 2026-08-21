import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updatePayoutStatus } from "@/lib/saas/payouts";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_PAYOUT")) return NextResponse.json({ error: "AFFILIATE_PAYOUT required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = String(body.status ?? "");
  try {
    const payout = await updatePayoutStatus(id, status as never);
    await writeSaasAudit({ byEmail: guard.user.email, action: `payout.${status}`, entity: "payout", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ payout });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
