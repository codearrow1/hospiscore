import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updatePayoutStatus } from "@/lib/saas/payouts";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH a partner-sourced payout (shared ledger). Rejects affiliate-owned rows.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_MANAGE")) return NextResponse.json({ error: "PARTNER_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const row = await prisma.affiliatePayout.findUnique({ where: { id }, select: { partnerId: true } });
  if (!row) return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  if (!row.partnerId) return NextResponse.json({ error: "Not a partner payout" }, { status: 400 });
  try {
    const payout = await updatePayoutStatus(id, String(body.status ?? "") as never);
    await writeSaasAudit({ byEmail: guard.user.email, action: `partner_payout.${body.status}`, entity: "payout", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ payout });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
