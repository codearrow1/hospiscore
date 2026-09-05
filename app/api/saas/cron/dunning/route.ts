import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { timingSafeEqual } from "node:crypto";
import { processDueCases } from "@/lib/saas/dunning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time string comparison — never leaks prefix matches via timing. */
function secretsMatch(a: string, b: string): boolean {
  const ha = Buffer.from(a, "utf8");
  const hb = Buffer.from(b, "utf8");
  if (ha.length !== hb.length) {
    // Still burn a comparison to keep timing uniform.
    timingSafeEqual(ha, ha);
    return false;
  }
  return timingSafeEqual(ha, hb);
}

/**
 * GET/POST /api/saas/cron/dunning — processes due dunning retries.
 * Protected: CRON_SECRET via X-Cron-Secret header, or BILLING_MANAGE session.
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && headerSecret && secretsMatch(cronSecret, headerSecret)) {
    const result = await processDueCases();
    return NextResponse.json({ ok: true, ...result });
  }
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  const result = await processDueCases();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
