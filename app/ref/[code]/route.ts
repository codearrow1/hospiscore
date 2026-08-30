import { NextRequest, NextResponse } from "next/server";
import { getAffiliateByCode, trackClick } from "@/lib/saas/affiliates";
import { clientIp } from "@/lib/marketing/guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public referral short-link: /ref/{CODE}
 *
 * Marketing material and affiliate portals advertise /ref/{code} links. This
 * handler makes them REAL: it records the click and drops the same `aff_ref`
 * / `aff_campaign` cookies the tracking endpoint sets, then redirects to the
 * site with `?ref=` + campaign preserved so downstream registration/checkout
 * can attribute the conversion even after a redirect. Unknown codes redirect
 * to the homepage without dropping a cookie (no broken funnel, no 404 UX).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = String(rawCode ?? "").trim().toUpperCase();
  const fallback = new URL("/", req.nextUrl.origin);

  if (!code) return NextResponse.redirect(fallback);

  const aff = await getAffiliateByCode(code).catch(() => null);
  if (!aff || (aff.status !== "active" && aff.status !== "approved")) {
    return NextResponse.redirect(fallback);
  }

  // Resolve campaign to honor configurable cookie duration.
  const campaignSlug = (req.nextUrl.searchParams.get("campaign") ?? "").trim().toLowerCase();
  let campaignId = aff.campaignId ?? null;
  let cookieDays = aff.customCookieDays ?? 90;
  if (campaignSlug) {
    const campaign = await prisma.affiliateCampaign.findUnique({
      where: { slug: campaignSlug },
      select: { id: true, cookieDays: true, status: true },
    });
    if (campaign && campaign.status === "active") {
      campaignId = campaign.id;
      cookieDays = campaign.cookieDays ?? cookieDays;
    }
  } else if (campaignId) {
    const campaign = await prisma.affiliateCampaign.findUnique({ where: { id: campaignId }, select: { cookieDays: true } });
    if (campaign?.cookieDays != null) cookieDays = campaign.cookieDays;
  }
  const effectiveCookieDays = aff.customCookieDays ?? cookieDays;

  let click;
  try {
    click = await trackClick(aff.id, {
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
      referrer: req.headers.get("referer") ?? undefined,
      utmSource: req.nextUrl.searchParams.get("utm_source") ?? undefined,
      utmMedium: req.nextUrl.searchParams.get("utm_medium") ?? undefined,
      utmCampaign: req.nextUrl.searchParams.get("utm_campaign") ?? undefined,
      campaignId: campaignId ?? undefined,
      landingPage: req.headers.get("referer") ?? undefined,
    });
  } catch {
    // Click recording must never block the redirect.
  }

  const target = new URL("/", req.nextUrl.origin);
  target.searchParams.set("ref", code);
  if (campaignSlug) target.searchParams.set("campaign", campaignSlug);
  if (click?.id) target.searchParams.set("cid", click.id);

  const res = NextResponse.redirect(target);
  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = { httpOnly: true, secure: isProd, maxAge: effectiveCookieDays * 86400, path: "/", sameSite: "lax" as const };
  res.cookies.set("aff_ref", code, cookieOpts);
  if (campaignSlug) res.cookies.set("aff_campaign", campaignSlug, cookieOpts);
  return res;
}
