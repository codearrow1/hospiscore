import { NextRequest, NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { originAllowed, rateLimit, clientIp } from "@/lib/marketing/guard";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { recordView, validateTrackInput } from "@/lib/marketing/track";
import { resolveCountry } from "@/lib/pricing/engine";
import { BILLING_COUNTRY_COOKIE } from "@/lib/pricing/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/track — privacy-light page-view beacon from the public
 * site. No cookies, no IP stored, deduped; rate-limited per client.
 */
export async function POST(req: NextRequest) {
  if (!CONFIG.trackViews) return NextResponse.json({ ok: false }, { status: 204 });
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Rejected" }, { status: 403 });
  }
  const key = `track:${clientIp(req)}`;
  if (!rateLimit(key, CONFIG.publicRateMax, CONFIG.publicRateWindowMs)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resolution = resolveCountry(req.headers, req.cookies.get(BILLING_COUNTRY_COOKIE)?.value);
  const ok = validateTrackInput({
    path: typeof body.path === "string" ? body.path : undefined,
    referrer: typeof body.referrer === "string" ? body.referrer : undefined,
    utmSource: typeof body.utmSource === "string" ? body.utmSource : undefined,
    utmMedium: typeof body.utmMedium === "string" ? body.utmMedium : undefined,
    utmCampaign: typeof body.utmCampaign === "string" ? body.utmCampaign : undefined,
    utmContent: typeof body.utmContent === "string" ? body.utmContent : undefined,
    utmTerm: typeof body.utmTerm === "string" ? body.utmTerm : undefined,
    country: resolution.country,
    session: typeof body.session === "string" ? body.session : undefined,
  });
  if (!ok) return NextResponse.json({ ok: false }, { status: 204 });

  await ensureMarketingStore();
  await recordView(ok);
  return NextResponse.json({ ok: true });
}