import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPartners } from "@/lib/saas/partners";
import { listPartnerCommissions, listPartnerPayouts } from "@/lib/saas/partners";
import PartnersManager from "@/components/saas/PartnersManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PartnersPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Partners", "Platform access required.");
  if (!hasSaasPerm(guard.user, "PARTNER_VIEW")) return restrictedPanel("Partners", "PARTNER_VIEW required.");
  const [{ items: partners }, { items: commissions }, { items: payouts }] = await Promise.all([
    listPartners({}),
    listPartnerCommissions({}),
    listPartnerPayouts({}),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Partners &amp; Resellers</h1>
        <p className="mt-1 text-sm text-zinc-500">Active sellers/implementers (vs referring affiliates). Same commission ledger and payout rails; isolated per partner.</p>
      </div>
      <PartnersManager
        initialPartners={partners as never[]}
        initialCommissions={commissions as never[]}
        initialPayouts={payouts as never[]}
        canManage={hasSaasPerm(guard.user, "PARTNER_MANAGE")}
      />
    </div>
  );
}
