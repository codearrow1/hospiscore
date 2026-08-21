import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listOrganizations } from "@/lib/saas/organizations";
import { seedDefaultPlans } from "@/lib/saas/plans";
import { SectionCard, EmptyState } from "@/components/marketing-admin/ui";
import NewOrgModal from "@/components/saas/NewOrgModal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrgsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Organizations", "Platform access required.");
  await seedDefaultPlans();
  const sp = (await searchParams) ?? {};
  const q = sp.q ?? "";
  const { items, total } = await listOrganizations({ q: q || undefined, take: 100 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{total} customers · SaaS organizations owning PMS tenants</p>
        </div>
        <NewOrgModal />
      </div>

      <form className="flex max-w-sm gap-2" action="/saas/organizations" method="GET">
        <input name="q" defaultValue={q} placeholder="Search legal name, business name…" className="w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700" />
        <button type="submit" className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900">Search</button>
      </form>

      {items.length === 0 ? (
        <SectionCard><EmptyState title="No organizations yet" body="Create your first SaaS customer organization." /></SectionCard>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">MRR</th>
                <th className="px-3 py-2">Contacts</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-3 py-2">
                    <Link href={`/saas/organizations/${o.id}`} className="font-semibold hover:text-indigo-600">{o.legalName}</Link>
                    {o.businessName && <span className="block text-xs text-zinc-400">{o.businessName}</span>}
                  </td>
                  <td className="px-3 py-2">{o.country || "—"}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{o.status}</span></td>
                  <td className="px-3 py-2 tabular-nums">${(o.mrr / 100).toFixed(2)}</td>
                  <td className="px-3 py-2">{o.contacts.length ? `${o.contacts[0].name} <${o.contacts[0].email}>` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
