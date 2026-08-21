import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listSubscriptions, createSubscription } from "@/lib/saas/subscriptions";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_VIEW")) return NextResponse.json({ error: "SUBSCRIPTION_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
  const planId = req.nextUrl.searchParams.get("planId") || undefined;
  const { items, total } = await listSubscriptions({ status, orgId, planId });
  return NextResponse.json({ subscriptions: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_MANAGE")) return NextResponse.json({ error: "SUBSCRIPTION_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const sub = await createSubscription({
      organizationId: String(body.organizationId ?? ""),
      planId: String(body.planId ?? ""),
      billingCycle: body.billingCycle === "yearly" ? "yearly" : "monthly",
      status: typeof body.status === "string" ? (body.status as never) : "trial",
      trialEndsAt: body.trialEndsAt ? new Date(String(body.trialEndsAt)) : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "subscription.created", entity: "subscription", entityId: sub.id, detail: `${sub.plan.slug} ${sub.billingCycle} ${(sub.mrr/100).toFixed(2)}`, ip: clientIp(req) });
    return NextResponse.json({ subscription: sub }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
