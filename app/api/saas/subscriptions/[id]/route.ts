import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getSubscription, updateSubscriptionStatus, changePlan, renewSubscription, isSubscriptionStatus } from "@/lib/saas/subscriptions";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_VIEW")) return NextResponse.json({ error: "SUBSCRIPTION_VIEW required" }, { status: 403 });
  const { id } = await params;
  const sub = await getSubscription(id);
  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  return NextResponse.json({ subscription: sub });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_MANAGE")) return NextResponse.json({ error: "SUBSCRIPTION_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    let sub;
    if (body.status) {
      if (!isSubscriptionStatus(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
      const before = await getSubscription(id);
      sub = await updateSubscriptionStatus(id, body.status as never);
      await writeSaasAudit({ byEmail: guard.user.email, action: "subscription.status_changed", entity: "subscription", entityId: id, detail: `${before?.status}→${body.status}`, ip: clientIp(req), before: { status: before?.status }, after: { status: body.status } });
    } else if (body.planId) {
      const before = await getSubscription(id);
      sub = await changePlan(id, String(body.planId), body.billingCycle === "yearly" ? "yearly" : body.billingCycle === "monthly" ? "monthly" : undefined);
      await writeSaasAudit({ byEmail: guard.user.email, action: "subscription.plan_changed", entity: "subscription", entityId: id, detail: `${before?.planId}→${body.planId}`, ip: clientIp(req) });
    } else if (body.action === "renew") {
      sub = await renewSubscription(id);
      await writeSaasAudit({ byEmail: guard.user.email, action: "subscription.renewed", entity: "subscription", entityId: id, ip: clientIp(req) });
    } else {
      return NextResponse.json({ error: "No actionable field: status|planId|action=renew" }, { status: 400 });
    }
    return NextResponse.json({ subscription: sub });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
