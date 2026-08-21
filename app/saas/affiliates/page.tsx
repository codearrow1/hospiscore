import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listAffiliates } from "@/lib/saas/affiliates";
import { listCommissions } from "@/lib/saas/commissions";
import { listPayouts } from "@/lib/saas/payouts";
import AffiliatesManager from "@/components/saas/AffiliatesManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AffiliatesPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Affiliates", "Platform access required.");
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return restrictedPanel("Affiliates", "AFFILIATE_VIEW required.");
  const sp = (await searchParams) ?? {};
  const status = sp.status as string | undefined;
  const [{ items: affiliates }, { items: commissions }, { items: payouts }] = await Promise.all([
    listAffiliates({ status }),
    listCommissions({}),
    listPayouts({}),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Affiliates</h1>
        <p className="mt-1 text-sm text-zinc-500">Referral network: link → click → lead → trial → subscription → commission → payout. Isolated per affiliate.</p>
      </div>
      <AffiliatesManager initialAffiliates={affiliates as never[]} initialCommissions={commissions as never[]} initialPayouts={payouts as never[]} canManage={hasSaasPerm(guard.user, "AFFILIATE_MANAGE")} canApprove={hasSaasPerm(guard.user, "AFFILIATE_APPROVE")} canPayout={hasSaasPerm(guard.user, "AFFILIATE_PAYOUT")} />
    </div>
  );
}
