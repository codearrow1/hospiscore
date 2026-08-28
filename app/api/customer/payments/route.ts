import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent, PaymentIntentError } from "@/lib/saas/payments/intents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["owner", "billing"];

/**
 * POST /api/customer/payments
 * Create a server-authoritative checkout intent for one of the caller
 * organization's outstanding invoices. Requires an owner|billing contact.
 * The server computes the amount from the invoice and verifies ownership —
 * the browser never supplies an amount.
 * body: { invoiceId, method?, returnUrl?, cancelUrl? }
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const orgId = access.org.organizationId;

  const contact = await prisma.orgContact.findUnique({ where: { id: access.org.contactId }, select: { role: true } });
  if (!contact || !(MANAGER_ROLES as string[]).includes(contact.role ?? "")) {
    return NextResponse.json({ error: "A billing or owner contact required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  if (!rateLimit(`custpay:${access.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const intent = await createPaymentIntent({
      organizationId: orgId,
      invoiceId,
      method: typeof body.method === "string" ? body.method : undefined,
      returnUrl: typeof body.returnUrl === "string" && body.returnUrl ? body.returnUrl : undefined,
      cancelUrl: typeof body.cancelUrl === "string" && body.cancelUrl ? body.cancelUrl : undefined,
      actorEmail: access.user.email,
      ip: clientIp(req),
    });
    return NextResponse.json({ intent });
  } catch (e) {
    if (e instanceof PaymentIntentError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 400 });
  }
}
