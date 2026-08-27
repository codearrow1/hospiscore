import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPayouts, createPayout } from "@/lib/saas/payouts";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "AFFILIATE_VIEW required" }, { status: 403 });
  const affiliateId = req.nextUrl.searchParams.get("affiliateId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listPayouts({ affiliateId, status });
  return NextResponse.json({ payouts: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AFFILIATE_PAYOUT")) return NextResponse.json({ error: "AFFILIATE_PAYOUT required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    const payout = await createPayout({
      affiliateId: String(body.affiliateId ?? ""),
      amount,
      currency: typeof body.currency === "string" ? body.currency : "USD",
      method: typeof body.method === "string" ? body.method : "bank",
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "payout.created", entity: "payout", entityId: payout.id, detail: `${payout.amount}`, ip: clientIp(req) });
    return NextResponse.json({ payout }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
