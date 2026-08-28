import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import FraudDashboard from "@/components/saas/FraudDashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FraudPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Fraud & risk", "Platform access required.");
  if (!hasSaasPerm(guard.user, "AFFILIATE_VIEW")) return restrictedPanel("Fraud & risk", "AFFILIATE_VIEW required.");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fraud &amp; risk</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          Affiliate commission-fraud review queue. Risk checks flag suspicious self-referrals,
          click spam, low conversion and instant cancellations. No auto-bans: every case is resolved
          by a human reviewer.
        </p>
      </div>
      <FraudDashboard />
    </div>
  );
}
