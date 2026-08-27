import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listSubscriptions, createSubscription, SUBSCRIPTION_STATUSES } from "@/lib/saas/subscriptions";
import { writeSaasAudit } from "@/lib/saas/audit";
import { SEED_COUNTRIES } from "@/lib/pricing/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/subscriptions — country/currency/plan/status/interval aware.
 * The subscription's charged currency+amount are authoritative; this endpoint
 * never converts or normalizes them into USD.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SUBSCRIPTION_VIEW")) return NextResponse.json({ error: "SUBSCRIPTION_VIEW required" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const { items, total } = await listSubscriptions({
    status: q.get("status") || undefined,
    orgId: q.get("organizationId") || undefined,
    planId: q.get("planId") || undefined,
    country: q.get("country") || undefined,
    currency: q.get("currency") || undefined,
    billingCycle: q.get("billingCycle") || undefined,
  });
  return NextResponse.json({
    subscriptions: items,
    total,
    countries: SEED_COUNTRIES.map((c) => ({ code: c.code, name: c.name, currency: c.currency })),
  });
}

/**
 * POST /api/saas/subscriptions — global multi-currency creation.
 * Body: { organizationId, planId, country?, billingCycle?, status?,
 *         unitAmount? (override), startAt? }
 * Country + plan resolve to the canonical PlanCountryPrice record; currency
 * is always that market's catalog currency. No US/USD default unless the
 * market itself resolves to US.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
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
      country: typeof body.country === "string" ? body.country : undefined,
      billingCycle: body.billingCycle === "yearly" ? "yearly" : "monthly",
      status: typeof body.status === "string" && SUBSCRIPTION_STATUSES.includes(body.status as never) ? (body.status as never) : "trial",
      trialEndsAt: body.trialEndsAt ? new Date(String(body.trialEndsAt)) : undefined,
      unitAmount: body.unitAmount !== undefined && body.unitAmount !== null && body.unitAmount !== "" ? Number(body.unitAmount) : undefined,
      startAt: body.startAt ? new Date(String(body.startAt)) : undefined,
    });
    await writeSaasAudit({
      byEmail: guard.user.email,
      action: "subscription.created",
      entity: "subscription",
      entityId: sub.id,
      detail: `${sub.plan.slug} ${sub.billingCycle} ${sub.currency} ${sub.unitAmount ?? "custom"} (${sub.country})`,
      ip: clientIp(req),
      after: { country: sub.country, currency: sub.currency, unitAmount: sub.unitAmount },
    });
    return NextResponse.json({ subscription: sub }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
