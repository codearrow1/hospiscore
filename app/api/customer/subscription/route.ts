import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";
import {
  scheduleCancellation,
  resumeSubscription,
  renewSubscription,
} from "@/lib/saas/subscriptions";
import {
  requestSubscriptionChange,
  previewSubscriptionChange,
} from "@/lib/saas/subscriptionPlan";
import { getCustomerSubscriptionOverview } from "@/lib/saas/customerSubscription";
import { writeSaasAudit } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["owner", "billing"];

/**
 * GET /api/customer/subscription — self-service overview for the caller's
 * organization: current subscription, eligible plans with customer prices,
 * usage vs plan limits, outstanding balance, and any open change request.
 */
export async function GET(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const overview = await getCustomerSubscriptionOverview(access.org.organizationId, access.org.contactId);
  return NextResponse.json(overview);
}

/**
 * POST /api/customer/subscription — self-service actions.
 * body.action ∈ { change | cancel | renew | resume }
 * Mutating actions require an owner|billing contact. Every action is
 * server-side, tenant-scoped to the caller's organization and audited.
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const orgId = access.org.organizationId;

  const contact = await prisma.orgContact.findUnique({
    where: { id: access.org.contactId },
    select: { role: true },
  });
  if (!contact || !(MANAGER_ROLES as string[]).includes(contact.role ?? "")) {
    return NextResponse.json({ error: "A billing or owner contact required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (!rateLimit(`custsub:${access.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) return NextResponse.json({ error: "No subscription found for this organization" }, { status: 404 });

  if (action === "change") {
    const toPlanId = typeof body.toPlanId === "string" ? body.toPlanId : "";
    const billingCycle = body.billingCycle;
    const cycle = billingCycle === "yearly" || billingCycle === "monthly" ? billingCycle : undefined;
    const result = await requestSubscriptionChange({
      organizationId: orgId,
      subscriptionId: subscription.id,
      toPlanId,
      billingCycle: cycle,
      requestedByEmail: access.user.email,
      requestedByUserId: access.user.id,
      ip: clientIp(req),
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, requestId: result.requestId });
  }

  if (action === "cancel") {
    try {
      await scheduleCancellation(subscription.id, access.user.email);
      await writeSaasAudit({
        byEmail: access.user.email,
        actorId: access.user.id,
        action: "subscription.cancel_scheduled",
        entity: "subscription",
        entityId: subscription.id,
        detail: `end-of-period cancellation requested by customer (org ${orgId})`,
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Cancel failed" }, { status: 400 });
    }
  }

  if (action === "resume") {
    try {
      await resumeSubscription(subscription.id, access.user.email);
      await writeSaasAudit({
        byEmail: access.user.email,
        actorId: access.user.id,
        action: "subscription.resumed",
        entity: "subscription",
        entityId: subscription.id,
        detail: `scheduled cancellation reversed by customer (org ${orgId})`,
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Resume failed" }, { status: 400 });
    }
  }

  if (action === "renew") {
    try {
      const updated = await renewSubscription(subscription.id, access.user.email);
      await writeSaasAudit({
        byEmail: access.user.email,
        actorId: access.user.id,
        action: "subscription.renewed",
        entity: "subscription",
        entityId: subscription.id,
        detail: `customer-initiated renewal (org ${orgId})`,
        ip: clientIp(req),
      });
      return NextResponse.json({ ok: true, subscription: updated });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Renew failed" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unsupported action — use change|cancel|renew|resume" }, { status: 400 });
}

/**
 * POST /api/customer/subscription/preview — compute the proration/price for a
 * prospective switch without creating a request. Read-only for any org member.
 */
export async function PATCH(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const orgId = access.org.organizationId;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  const toPlanId = typeof body.toPlanId === "string" ? body.toPlanId : "";
  const billingCycle = body.billingCycle;
  const cycle = billingCycle === "yearly" || billingCycle === "monthly" ? billingCycle : undefined;
  try {
    const preview = await previewSubscriptionChange({ organizationId: orgId, subscriptionId: subscription.id, toPlanId, billingCycle: cycle });
    return NextResponse.json({ preview });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Preview failed" }, { status: 400 });
  }
}
