import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Partner portal — returns own partner record + commissions/payouts/referred
// orgs. Strictly scoped to the caller; never exposes other partners' data.
export async function GET() {
  await initSaasDb().catch(() => {});
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const partner = await prisma.partner.findFirst({
    where: { OR: [{ email: user.email }, { userId: user.id }] },
  });
  if (!partner) return NextResponse.json({ partner: null, commissions: [], payouts: [], referredOrgs: 0 });

  const [commissions, payouts, referredOrgs] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.affiliatePayout.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.organization.count({ where: { partnerId: partner.id } }),
  ]);

  return NextResponse.json({ partner, commissions, payouts, referredOrgs });
}
