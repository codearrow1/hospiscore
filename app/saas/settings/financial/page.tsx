import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import FinancialControlsForm from "@/components/saas/FinancialControlsForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FinancialControlsPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Financial controls", "Platform access required.");
  if (!hasSaasPerm(guard.user, "FINANCIAL_APPROVE")) {
    return restrictedPanel("Financial controls", "FINANCIAL_APPROVE required to configure financial controls.");
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Financial controls</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure the four-eyes dual-approval policy for high-risk financial actions. Changes apply immediately and are
          enforced server-side on every void, refund and payout-release attempt.
        </p>
      </div>
      <FinancialControlsForm viewerEmail={guard.user.email} />
    </div>
  );
}
