import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listInvoices } from "@/lib/saas/billing";
import { createInvoice } from "@/lib/saas/gateway";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_VIEW")) return NextResponse.json({ error: "BILLING_VIEW required" }, { status: 403 });
  const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listInvoices({ orgId, status });
  return NextResponse.json({ invoices: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const organizationId = String(body.organizationId ?? "");
  if (body.amount === null || body.amount === undefined || body.amount === "") {
    return NextResponse.json({ error: "amount is required" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!organizationId || !Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "organizationId and amount>=0 required" }, { status: 400 });
  try {
    const inv = await createInvoice({
      organizationId,
      subscriptionId: typeof body.subscriptionId === "string" ? body.subscriptionId : undefined,
      amount: Math.round(amount),
      currency: typeof body.currency === "string" ? body.currency : "USD",
      type: typeof body.type === "string" ? body.type : "subscription",
      dueAt: body.dueAt ? new Date(String(body.dueAt)) : undefined,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
      couponCode: typeof body.couponCode === "string" && body.couponCode ? body.couponCode : undefined,
      actorEmail: guard.user.email,
      ip: clientIp(req),
    });
    return NextResponse.json({ invoice: inv }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
