import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updatePayoutStatus } from "@/lib/saas/payouts";
import type { PayoutStatus } from "@/lib/saas/payouts";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { initSaasDb } from "@/lib/saas/init";
import { prisma } from "@/lib/prisma";

const PAYOUT_STATUSES: PayoutStatus[] = ["requested", "approved", "processing", "paid", "failed"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });

  const { id } = await params;
  const payout = await prisma.affiliatePayout.findUnique({
    where: { id },
    include: { affiliate: { select: { id: true, name: true, email: true, referralCode: true } } },
  });
  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  return NextResponse.json({ payout });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_PAYOUT")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = String(body.status ?? "");
  if (!status || !PAYOUT_STATUSES.includes(status as PayoutStatus)) {
    return NextResponse.json({ error: `Invalid status. Allowed: ${PAYOUT_STATUSES.join(", ")}` }, { status: 400 });
  }

  try {
    const payout = await updatePayoutStatus(id, status as PayoutStatus);
    await writeSaasAudit({ byEmail: user.email, action: "payout.status_changed", entity: "payout", entityId: id, detail: status, ip: clientIp(req) });
    return NextResponse.json({ payout });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
