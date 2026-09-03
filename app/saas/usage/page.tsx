import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listOrganizations } from "@/lib/saas/organizations";
import UsageDashboard from "@/components/saas/UsageDashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function UsagePage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Usage", "Platform access required.");
  const { items: orgs } = await listOrganizations({ take: 100 });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage &amp; Entitlements</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Per-organization usage vs plan limits, enforced server-side via <code>enforceLimit()</code>.
          </p>
        </div>
        <Link
          href="/saas/feature-flags"
          className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Feature Flags →
        </Link>
      </div>
      {orgs.length === 0 ? (
        <p className="text-sm text-zinc-500">No organizations yet — create one first.</p>
      ) : (
        <UsageDashboard orgs={orgs.map((o) => ({ id: o.id, legalName: o.legalName }))} />
      )}
    </div>
  );
}
