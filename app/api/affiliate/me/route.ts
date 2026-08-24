import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { findAffiliateForUser } from "@/lib/saas/portalLinks";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Affiliate portal — returns own affiliate + commissions/payouts, never others
export async function GET() {
  await initSaasDb().catch(() => {});
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // Identity requires an explicit binding (userId column or admin-minted
  // claim) — a matching email alone grants nothing.
  const aff = await findAffiliateForUser(user.id);
  if (!aff) return NextResponse.json({ affiliate: null, commissions: [], payouts: [] });

  const [commissions, payouts, clicks] = await Promise.all([
    prisma.affiliateCommission.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.affiliatePayout.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.affiliateClick.count({ where: { affiliateId: aff.id } }),
  ]);
  return NextResponse.json({ affiliate: aff, commissions, payouts, clicks });
}
