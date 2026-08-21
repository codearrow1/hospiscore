import { NextRequest, NextResponse } from "next/server";
import { trackClick, getAffiliateByCode } from "@/lib/saas/affiliates";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/affiliate/track { code } or GET ?ref=CODE — records click, sets cookie
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { body = {}; }
  const code = String(body.code ?? body.ref ?? req.nextUrl.searchParams.get("ref") ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const aff = await getAffiliateByCode(code);
  if (!aff) return NextResponse.json({ error: "Unknown referral code" }, { status: 404 });
  if (aff.status !== "active" && aff.status !== "approved") return NextResponse.json({ error: "Affiliate not active" }, { status: 403 });
  const click = await trackClick(aff.id, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") || undefined,
    referrer: req.headers.get("referer") || undefined,
    utmSource: req.nextUrl.searchParams.get("utm_source") || undefined,
    utmMedium: req.nextUrl.searchParams.get("utm_medium") || undefined,
    utmCampaign: req.nextUrl.searchParams.get("utm_campaign") || undefined,
  });
  const res = NextResponse.json({ ok: true, affiliateId: aff.id, clickId: click.id });
  // Set 90-day referral cookie
  res.cookies.set("aff_ref", code, { httpOnly: true, maxAge: 90 * 86400, path: "/" });
  return res;
}

export async function GET(req: NextRequest) {
  return POST(req);
}
