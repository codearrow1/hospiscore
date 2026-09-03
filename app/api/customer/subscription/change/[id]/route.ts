import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";
import { cancelSubscriptionChange } from "@/lib/saas/subscriptionPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/customer/subscription/change/:id — withdraw the caller's own
 * pending plan-change request (requester-only, tenant-scoped).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;

  // Tenant isolation: the request must belong to the caller's org.
  const reqRow = await prisma.planChangeRequest.findUnique({ where: { id } });
  if (!reqRow || reqRow.organizationId !== access.org.organizationId) {
    return NextResponse.json({ error: "request not found" }, { status: 404 });
  }

  const result = await cancelSubscriptionChange(id, { email: access.user.email, userId: access.user.id }, clientIp(req));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
