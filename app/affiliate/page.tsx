import { Suspense } from "react";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { initSaasDb } from "@/lib/saas/init";
import { notFound } from "next/navigation";
import AffiliatePortal from "@/components/affiliate/AffiliatePortal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AffiliatePage() {
  const user = await getCurrentUser();
  if (!user) return notFound();

  await initSaasDb().catch(() => {});

  const affiliate = await prisma.affiliate.findFirst({
    where: { userId: user.id },
    include: {
      campaign: { select: { name: true, slug: true, commissionModel: true, commissionValue: true, cookieDays: true, recurringDuration: true } },
    },
  });

  if (!affiliate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Affiliate Program</h1>
          <p className="text-gray-600 mb-6">You are not yet enrolled as an affiliate.</p>
          <a href="/affiliate/apply" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            Apply to Join
          </a>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <AffiliatePortal affiliate={JSON.parse(JSON.stringify(affiliate))} />
    </Suspense>
  );
}
