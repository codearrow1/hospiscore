import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { findAffiliateForUser } from "@/lib/saas/portalLinks";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { initSaasDb } from "@/lib/saas/init";
import { recruitAffiliate } from "@/lib/saas/multiTier";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Affiliate portal recruit — resolves childReferralCode → childAffiliateId server-side
export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const aff = await findAffiliateForUser(user.id);
  if (!aff) return NextResponse.json({ error: "No affiliate account" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const childReferralCode = String(body.childReferralCode ?? "").trim();
  if (!childReferralCode) return NextResponse.json({ error: "childReferralCode required" }, { status: 400 });

  // Resolve the referral code to an affiliate ID (SQLite doesn't support mode: insensitive, normalize both sides)
  const child = await prisma.affiliate.findFirst({
    where: { referralCode: childReferralCode.toUpperCase() },
    select: { id: true },
  });
  if (!child) return NextResponse.json({ error: "No affiliate found with that referral code" }, { status: 404 });

  try {
    const result = await recruitAffiliate({ parentAffiliateId: aff.id, childAffiliateId: child.id });
    await writeSaasAudit({ byEmail: aff.email, action: "affiliate.recruited", entity: "affiliate", entityId: aff.id, detail: child.id, ip: clientIp(req) });
    return NextResponse.json({ recruitment: result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Recruit failed" }, { status: 400 });
  }
}
