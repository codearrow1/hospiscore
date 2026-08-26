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
      <div className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Affiliate Program</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">You are not yet enrolled as an affiliate.</p>
          <a href="/affiliate/apply" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500">
            Apply to Join
          </a>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" /></div>}>
      <AffiliatePortal affiliate={JSON.parse(JSON.stringify(affiliate))} />
    </Suspense>
  );
}
