import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPartnerPayouts, requestPartnerPayout } from "@/lib/saas/partners";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_VIEW")) return NextResponse.json({ error: "PARTNER_VIEW required" }, { status: 403 });
  const partnerId = req.nextUrl.searchParams.get("partnerId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listPartnerPayouts({ partnerId, status });
  return NextResponse.json({ payouts: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_MANAGE")) return NextResponse.json({ error: "PARTNER_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const payout = await requestPartnerPayout({
      partnerId: String(body.partnerId ?? ""),
      amount: Number(body.amount),
      method: typeof body.method === "string" ? body.method : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "partner_payout.created", entity: "payout", entityId: payout.id, detail: `${payout.amount}`, ip: clientIp(req) });
    return NextResponse.json({ payout }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
