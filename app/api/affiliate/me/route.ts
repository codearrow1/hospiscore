import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { findAffiliateForUser } from "@/lib/saas/portalLinks";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Affiliate portal — returns own affiliate + commissions/payouts/campaign, never others
export async function GET() {
  await initSaasDb().catch(() => {});
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // Identity requires an explicit binding (userId column or admin-minted
  // claim) — a matching email alone grants nothing.
  const aff = await findAffiliateForUser(user.id);
  if (!aff) return NextResponse.json({ affiliate: null, commissions: [], payouts: [] });

  const [commissions, payouts, clicks, campaign, attributionCount, notificationCount, paidAgg, pendingAgg] = await Promise.all([
    prisma.affiliateCommission.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.affiliatePayout.findMany({ where: { affiliateId: aff.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.affiliateClick.count({ where: { affiliateId: aff.id } }),
    aff.campaignId ? prisma.affiliateCampaign.findUnique({
      where: { id: aff.campaignId },
      select: { name: true, slug: true, commissionModel: true, commissionValue: true, recurringDuration: true, cookieDays: true, holdingPeriodDays: true },
    }) : null,
    prisma.affiliateAttribution.count({ where: { affiliateId: aff.id } }),
    prisma.affiliateNotification.count({ where: { affiliateId: aff.id, readAt: null } }),
    prisma.affiliateCommission.aggregate({ where: { affiliateId: aff.id, status: { in: ["eligible", "approved", "payable", "paid"] } }, _sum: { amount: true } }),
    prisma.affiliatePayout.aggregate({ where: { affiliateId: aff.id, status: { in: ["requested", "approved", "processing"] } }, _sum: { amount: true } }),
  ]);

  const totalEarnings = paidAgg._sum.amount ?? 0;
  const pendingBalance = Math.max(0, totalEarnings - (pendingAgg._sum.amount ?? 0));

  return NextResponse.json({
    affiliate: aff,
    commissions,
    payouts,
    clicks,
    campaign,
    attributionCount,
    unreadNotifications: notificationCount,
    stats: {
      totalClicks: clicks,
      totalConversions: attributionCount,
      totalEarnings,
      pendingBalance,
    },
  });
}
