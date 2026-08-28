import { NextRequest, NextResponse } from "next/server";
import { originAllowed } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/customer/payments/[id]
 * Fetch the status of one checkout intent, tenant-scoped to the caller's
 * organization. Any member of the org may view (read-only). Returns masked /
 * safe fields only — never credentials.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = _req.headers.get("origin");
  if (origin && !originAllowed(_req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { id } = await ctx.params;
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: String(id), organizationId: access.org.organizationId },
    select: {
      id: true,
      provider: true,
      amount: true,
      currency: true,
      status: true,
      checkoutUrl: true,
      clientToken: true,
      providerRef: true,
      expiresAt: true,
      settledPaymentId: true,
      createdAt: true,
    },
  });
  if (!intent) return NextResponse.json({ error: "Intent not found" }, { status: 404 });
  return NextResponse.json({ intent });
}
