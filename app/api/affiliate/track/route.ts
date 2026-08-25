import { NextRequest, NextResponse } from "next/server";
import { trackClick, getAffiliateByCode } from "@/lib/saas/affiliates";
import { clientIp } from "@/lib/marketing/guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/affiliate/track { code, campaign? } or GET ?ref=CODE&campaign=SLUG
// Records click, sets configurable cookie
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { body = {}; }
  const code = String(body.code ?? body.ref ?? req.nextUrl.searchParams.get("ref") ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const aff = await getAffiliateByCode(code);
  if (!aff) return NextResponse.json({ error: "Unknown referral code" }, { status: 404 });
  if (aff.status !== "active" && aff.status !== "approved") return NextResponse.json({ error: "Affiliate not active" }, { status: 403 });

  // Resolve campaign — campaign param overrides affiliate's default
  const campaignSlug = String(body.campaign ?? req.nextUrl.searchParams.get("campaign") ?? "").trim().toLowerCase();
  let campaignId = aff.campaignId || null;
  let cookieDays = 90;

  if (campaignSlug) {
    const campaign = await prisma.affiliateCampaign.findUnique({
      where: { slug: campaignSlug },
      select: { id: true, cookieDays: true, status: true },
    });
    if (campaign && campaign.status === "active") {
      campaignId = campaign.id;
      cookieDays = campaign.cookieDays;
    }
  } else if (campaignId) {
    // Fetch cookie duration from the affiliate's default campaign
    const campaign = await prisma.affiliateCampaign.findUnique({
      where: { id: campaignId },
      select: { cookieDays: true },
    });
    if (campaign) cookieDays = campaign.cookieDays;
  }

  // Affiliate-level cookie override
  const effectiveCookieDays = aff.customCookieDays || cookieDays;

  const landingPage = req.nextUrl.searchParams.get("landing") || req.headers.get("referer") || undefined;
  const sessionId = req.nextUrl.searchParams.get("sid") || undefined;

  const click = await trackClick(aff.id, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") || undefined,
    referrer: req.headers.get("referer") || undefined,
    utmSource: req.nextUrl.searchParams.get("utm_source") || undefined,
    utmMedium: req.nextUrl.searchParams.get("utm_medium") || undefined,
    utmCampaign: req.nextUrl.searchParams.get("utm_campaign") || undefined,
    campaignId: campaignId || undefined,
    landingPage,
    sessionId,
  });

  const res = NextResponse.json({
    ok: true,
    affiliateId: aff.id,
    clickId: click.id,
    campaignId,
    cookieDays: effectiveCookieDays,
  });

  // Set referral cookie with campaign-configurable duration
  res.cookies.set("aff_ref", code, {
    httpOnly: true,
    maxAge: effectiveCookieDays * 86400,
    path: "/",
    sameSite: "lax",
  });

  // Also store campaign slug in a separate cookie for downstream use
  if (campaignSlug) {
    res.cookies.set("aff_campaign", campaignSlug, {
      httpOnly: true,
      maxAge: effectiveCookieDays * 86400,
      path: "/",
      sameSite: "lax",
    });
  }

  return res;
}

export async function GET(req: NextRequest) {
  return POST(req);
}
