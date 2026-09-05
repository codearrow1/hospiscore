import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireCapability } from "@/lib/marketing/guard";
import { getFollowUpDigest, sendFollowUpDigest, buildDigestHtml } from "@/lib/marketing/followups";

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
 * GET /api/marketing/cron/followups?send=1
 * Returns the current follow-up digest. With send=1, also emails the digest
 * to sales + per-owner. Protected: requires leads.read capability, or a
 * cron secret (CRON_SECRET) matching X-Cron-Secret header.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const headerSecret = req.headers.get("x-cron-secret")?.trim();
  let authorized = false;
  if (cronSecret && headerSecret && secretsMatch(cronSecret, headerSecret)) {
    authorized = true;
  } else {
    const guard = await requireCapability("leads.read");
    if (!guard.ok) return guard.response;
    authorized = true;
  }
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const send = req.nextUrl.searchParams.get("send") === "1";
  const digest = await getFollowUpDigest();
  if (!send) {
    return NextResponse.json({
      ok: true,
      generatedAt: digest.generatedAt,
      overdue: digest.overdue.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        stage: l.stage,
        ownerEmail: l.ownerEmail,
        nextFollowUpAt: l.nextFollowUpAt,
      })),
      dueSoon: digest.dueSoon.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        stage: l.stage,
        ownerEmail: l.ownerEmail,
        nextFollowUpAt: l.nextFollowUpAt,
      })),
      htmlPreview: buildDigestHtml(digest),
    });
  }
  const result = await sendFollowUpDigest();
  return NextResponse.json({ ok: true, ...result, generatedAt: digest.generatedAt });
}
