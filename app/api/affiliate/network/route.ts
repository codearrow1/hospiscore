import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { findAffiliateForUser } from "@/lib/saas/portalLinks";
import { listRecruitedAffiliates } from "@/lib/saas/multiTier";
import { initSaasDb } from "@/lib/saas/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Affiliate portal — returns the current affiliate's recruited network
// (direct children of this affiliate), never another affiliate's tree.
export async function GET() {
  await initSaasDb().catch(() => {});
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const aff = await findAffiliateForUser(user.id);
  if (!aff) return NextResponse.json({ network: [], count: 0 });

  const recruits = await listRecruitedAffiliates(aff.id);

  return NextResponse.json({
    count: recruits.length,
    network: recruits.map((r) => ({
      id: r.child.id,
      name: r.child.name,
      email: r.child.email,
      referralCode: r.child.referralCode,
      status: r.child.status,
      tier: r.child.tier,
      recruitedAt: r.createdAt,
    })),
  });
}
