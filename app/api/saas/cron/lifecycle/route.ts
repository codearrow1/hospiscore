import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { classifyLifecycle } from "@/lib/saas/lifecycle";
import { canTransition } from "@/lib/saas/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time string comparison — never leaks prefix matches via timing. */
function secretsMatch(a: string, b: string): boolean {
  const ha = Buffer.from(a, "utf8");
  const hb = Buffer.from(b, "utf8");
  if (ha.length !== hb.length) {
    timingSafeEqual(ha, ha);
    return false;
  }
  return timingSafeEqual(ha, hb);
}

/**
 * Applies every due lifecycle transition (M-06). Pure classification first,
 * then the guarded state machine — an illegal transition is skipped and
 * counted rather than forced.
 */
async function sweep(now = new Date()) {
  const { prisma } = await import("@/lib/prisma");
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["trial", "active", "past_due", "grace"] } },
    select: { id: true, status: true, organizationId: true, currentPeriodEnd: true, trialEndsAt: true },
    take: 500,
  });
  let expired = 0;
  let pastDue = 0;
  let suspended = 0;
  for (const s of subs) {
    const target = classifyLifecycle(s, now.getTime());
    if (!target) continue;
    const from = s.status as "trial" | "active" | "past_due" | "grace";
    if (!canTransition(from, target)) continue;
    await prisma.subscription.update({ where: { id: s.id }, data: { status: target } });
    if (target === "expired") expired += 1;
    else if (target === "past_due") pastDue += 1;
    else if (target === "suspended") suspended += 1;
    // Every automated money-affecting state change is individually auditable.
    try {
      const { writeSaasAudit } = await import("@/lib/saas/audit");
      await writeSaasAudit({
        byEmail: "system:lifecycle-cron",
        action: "subscription.lifecycle",
        entity: "subscription",
        entityId: s.id,
        detail: `${s.status} → ${target}`,
      });
    } catch (e) { console.error("[lifecycle] audit write failed:", e); }
    try {
      const { syncOrgMrr } = await import("@/lib/saas/subscriptions");
      await syncOrgMrr(s.organizationId);
    } catch (e) { console.error("[lifecycle] syncOrgMrr failed:", e); }
  }
  return { processed: subs.length, expired, pastDue, suspended };
}

/**
 * GET /api/saas/cron/lifecycle — CRON_SECRET schedulers only.
 * A top-level navigation must never be able to mutate subscription states
 * while an admin browses (SameSite=Lax), so session callers use POST.
 */
async function handle(req: NextRequest, allowSession: boolean) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && headerSecret && secretsMatch(cronSecret, headerSecret)) {
    return NextResponse.json({ ok: true, ...(await sweep()) });
  }
  if (!allowSession) {
    return NextResponse.json({ error: "X-Cron-Secret required for GET" }, { status: 401 });
  }
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await sweep()) });
}

export async function GET(req: NextRequest) {
  return handle(req, false);
}

export async function POST(req: NextRequest) {
  return handle(req, true);
}
