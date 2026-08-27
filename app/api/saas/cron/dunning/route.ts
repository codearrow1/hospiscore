import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { secretsMatch } from "@/lib/saas/cronAuth";
import { processDueCases } from "@/lib/saas/dunning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/saas/cron/dunning — processes due dunning retries.
 * Protected: CRON_SECRET via X-Cron-Secret header, or BILLING_MANAGE session
 * (same-origin enforced by middleware). GET is reserved for secret-bearing
 * external schedulers only — a top-level cross-site navigation must never be
 * able to fire dunning side effects while an admin browses.
 */
async function handle(req: NextRequest, allowSession: boolean) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && headerSecret && secretsMatch(cronSecret, headerSecret)) {
    const result = await processDueCases();
    return NextResponse.json({ ok: true, ...result });
  }
  if (!allowSession) {
    return NextResponse.json({ error: "X-Cron-Secret required for GET" }, { status: 401 });
  }
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  const result = await processDueCases();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) { return handle(req, false); }
export async function POST(req: NextRequest) { return handle(req, true); }
