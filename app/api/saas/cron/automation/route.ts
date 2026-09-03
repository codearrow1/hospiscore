import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { secretsMatch } from "@/lib/saas/cronAuth";
import { runAutomationSweep, listAutomationEvents } from "@/lib/saas/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/cron/automation — lists recent automation events.
 * POST — runs a full lifecycle sweep. Protected: CRON_SECRET via
 * X-Cron-Secret header, or MARKETING_MANAGE session.
 */
async function authorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret && headerSecret && secretsMatch(cronSecret, headerSecret)) return true;
  const guard = await requireSaasAccess();
  return guard.ok && hasSaasPerm(guard.user, "MARKETING_MANAGE");
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rule = req.nextUrl.searchParams.get("rule") || undefined;
  const { items, total } = await listAutomationEvents({ rule });
  return NextResponse.json({ events: items, total });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runAutomationSweep();
  return NextResponse.json({ ok: true, ...result });
}
