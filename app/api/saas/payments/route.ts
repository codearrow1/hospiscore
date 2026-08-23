import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPayments } from "@/lib/saas/billing";
import { recordPayment, refundPayment } from "@/lib/saas/gateway";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_VIEW")) return NextResponse.json({ error: "BILLING_VIEW required" }, { status: 403 });
  const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listPayments({ orgId, status });
  return NextResponse.json({ payments: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // refund flow: { paymentId, action:"refund" }
  if (body.action === "refund" && typeof body.paymentId === "string") {
    if (!hasSaasPerm(guard.user, "REFUND_APPROVE")) return NextResponse.json({ error: "REFUND_APPROVE required" }, { status: 403 });
    try {
      const p = await refundPayment(String(body.paymentId), guard.user.email, clientIp(req));
      return NextResponse.json({ payment: p });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Refund failed" }, { status: 400 });
    }
  }

  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  const organizationId = String(body.organizationId ?? "");
  // Strict amount coercion — null/"" must not become a $0 payment.
  if (body.amount === null || body.amount === undefined || body.amount === "") {
    return NextResponse.json({ error: "amount is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!organizationId || !Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "organizationId and amount>=0 required" }, { status: 400 });
  try {
    const pay = await recordPayment({
      organizationId,
      invoiceId: typeof body.invoiceId === "string" ? body.invoiceId : undefined,
      amount: Math.round(amount),
      gateway: typeof body.gateway === "string" ? body.gateway : "manual",
      status: typeof body.status === "string" ? body.status : "succeeded",
      actorEmail: guard.user.email,
      ip: clientIp(req),
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    });
    return NextResponse.json({ payment: pay }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
