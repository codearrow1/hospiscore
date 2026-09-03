import { NextRequest, NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { originAllowed, rateLimit, clientIp } from "@/lib/marketing/guard";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import {
  recordMarketingEvent,
  validateMarketingEvent,
} from "@/lib/marketing/eventsPub";
import { resolveCountry } from "@/lib/pricing/engine";
import { BILLING_COUNTRY_COOKIE } from "@/lib/pricing/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/track-event — privacy-light named conversion event from
 * the public site (e.g. demo_cta, score_submit). Session-keyed, no PII,
 * deduped, rate-limited per client. Additive companion to
 * /api/marketing/track (page views); never changes the page-view pipeline.
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Rejected" }, { status: 403 });
  }
  const key = `trackevt:${clientIp(req)}`;
  if (!rateLimit(key, CONFIG.publicRateMax, CONFIG.publicRateWindowMs)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resolution = resolveCountry(
    req.headers,
    req.cookies.get(BILLING_COUNTRY_COOKIE)?.value,
  );
  const ok = validateMarketingEvent({
    name: typeof body.name === "string" ? body.name : undefined,
    meta: typeof body.meta === "string" ? body.meta : undefined,
    country: resolution.country,
    session: typeof body.session === "string" ? body.session : undefined,
  });
  if (!ok) return new NextResponse(null, { status: 204 });

  await ensureMarketingStore();
  await recordMarketingEvent(ok);
  return NextResponse.json({ ok: true });
}