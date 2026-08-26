import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { restrictedPanel } from "@/app/marketing-admin/restricted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrgBillingPage() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return restrictedPanel("Organization Billing", "Platform access required.");
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) {
    return restrictedPanel("Organization Billing", "Finance Admin access required.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Organization Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage billing contacts, payment methods, and view invoices for your organization.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Invoices &amp; Payments</h2>
        <p className="mt-1 text-sm text-zinc-500">
          View and manage invoices and payment history.
        </p>
        <div className="mt-4">
          <a
            href="/saas/billing"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:hover:border-indigo-700"
          >
            Go to Billing Dashboard →
          </a>
        </div>
      </section>
    </div>
  );
}
