import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { getAffiliateByEmail } from "@/lib/saas/affiliates";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Affiliate portal — returns own affiliate + commissions/payouts, never others
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // Find affiliate by email (or userId link)
  let aff = await getAffiliateByEmail(user.email);
  if (!aff) {
    // also try by userId
    const byUser = await prisma.affiliate.findFirst({ where: { userId: user.id } });
    aff = byUser;
  }
  if (!aff) return NextResponse.json({ affiliate: null, commissions: [], payouts: [] });

  const [commissions, payouts, clicks] = await Promise.all([
    prisma.affiliateCommission.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.affiliatePayout.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.affiliateClick.count({ where: { affiliateId: aff.id } }),
  ]);
  return NextResponse.json({ affiliate: aff, commissions, payouts, clicks });
}
