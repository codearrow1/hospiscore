import { NextRequest, NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { originAllowed, rateLimit, clientIp } from "@/lib/marketing/guard";
import { handleFormSubmission } from "@/lib/marketing/forms";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { resolveCountry } from "@/lib/pricing/engine";
import { BILLING_COUNTRY_COOKIE } from "@/lib/pricing/countries";
import type { LeadSource } from "@/lib/marketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { FormSubmission } from "@/lib/marketing/forms";

/**
 * POST /api/marketing/forms/[slug] — public form submission. Validates against
 * the stored form config, upserts a lead with full attribution, honors
 * destinations (auto-reply + team notification) and rate-limits per client.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Rejected" }, { status: 403 });
  }
  const key = `form:${slug}:${clientIp(req)}`;
  if (!rateLimit(key, CONFIG.publicRateMax, CONFIG.publicRateWindowMs)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await ensureMarketingStore();

  const resolution = resolveCountry(req.headers, req.cookies.get(BILLING_COUNTRY_COOKIE)?.value);
  const url = new URL(req.url);
  const meta = {
    medium: str(body.utmMedium) ?? url.searchParams.get("utm_medium") ?? undefined,
    campaign: str(body.utmCampaign) ?? url.searchParams.get("utm_campaign") ?? undefined,
    content: str(body.utmContent) ?? url.searchParams.get("utm_content") ?? undefined,
    term: str(body.utmTerm) ?? url.searchParams.get("utm_term") ?? undefined,
    source: (str(body.utmSource) ?? url.searchParams.get("utm_source") ?? undefined) as LeadSource | undefined,
    sourceDetail: str(body.sourceDetail),
    landing: req.headers.get("referer") ?? undefined,
    referrer: req.headers.get("referer") ?? undefined,
    pagePath: typeof body.pagePath === "string" ? body.pagePath.slice(0, 400) : undefined,
    country: resolution.country,
    ip: clientIp(req),
  };

  const result = await handleFormSubmission(slug, body, meta);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    leadId: result.leadId,
    thankYou: result.thankYou,
    redirectUrl: result.redirectUrl,
  });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v.slice(0, 160) : undefined;
}