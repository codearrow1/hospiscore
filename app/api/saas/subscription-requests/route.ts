import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listSubscriptionChangeRequests } from "@/lib/saas/subscriptionPlan";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/subscription-requests — pending/customer plan-switch requests
 * for the admin approval panel. Requires SUBSCRIPTION_VIEW.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_VIEW")) return NextResponse.json({ error: "SUBSCRIPTION_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const requests = await listSubscriptionChangeRequests({ status, take: 200 });

  const orgIds = [...new Set(requests.map((r) => r.organizationId).filter(Boolean) as string[])];
  const planIds = [
    ...new Set(requests.flatMap((r) => [r.fromPlanId, r.toPlanId]).filter(Boolean) as string[]),
  ];
  const [orgs, plans] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, legalName: true, businessName: true, country: true } }),
    prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true, slug: true } }),
  ]);
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const planMap = new Map(plans.map((p) => [p.id, p]));

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      requestedByEmail: r.requestedByEmail,
      createdAt: r.createdAt,
      reviewedByEmail: r.reviewedByEmail,
      reviewedAt: r.reviewedAt,
      rejectionReason: r.rejectionReason,
      reason: r.reason,
      organization: r.organizationId ? orgMap.get(r.organizationId) ?? null : null,
      fromPlan: r.fromPlanId ? planMap.get(r.fromPlanId) ?? null : null,
      toPlan: r.toPlanId ? planMap.get(r.toPlanId) ?? null : null,
      billingCycle: r.billingCycle,
      proposedSnapshot: r.proposedSnapshot,
    })),
  });
}
