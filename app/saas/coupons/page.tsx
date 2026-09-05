import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listCoupons } from "@/lib/saas/coupons";
import CouponsManager from "@/components/saas/CouponsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CouponsPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Coupons", "Platform access required.");
  if (!hasSaasPerm(guard.user, "MARKETING_VIEW")) return restrictedPanel("Coupons", "MARKETING_VIEW required.");
  const { items } = await listCoupons({});
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Coupons &amp; Promotions</h1>
        <p className="mt-1 text-sm text-zinc-500">Discount codes applied at invoice creation. One redemption per organization; immutable redemption ledger.</p>
      </div>
      <CouponsManager initialCoupons={items as never[]} canManage={hasSaasPerm(guard.user, "MARKETING_MANAGE")} />
    </div>
  );
}
