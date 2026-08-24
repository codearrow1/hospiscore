import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listOrganizations, listOrganizationCountries, type OrgSortField } from "@/lib/saas/organizations";
import { seedDefaultPlans } from "@/lib/saas/plans";
import { hasSaasPerm } from "@/lib/saas/roles";
import { EmptyState, StatusBadge } from "@/components/ui";
import { FilterChip } from "@/components/ui/Pagination";
import NewOrgModal from "@/components/saas/NewOrgModal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 20;
const ORG_STATUSES = ["active", "trial", "suspended", "cancelled"] as const;

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function OrgsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Organizations", "Platform access required.");
  const user = guard.user;
  await seedDefaultPlans();

  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim() ?? "";
  const status = ORG_STATUSES.includes((sp.status ?? "") as never) ? sp.status! : "";
  const country = sp.country?.trim() ?? "";
  const sort = (["createdAt", "legalName", "mrr", "healthScore"].includes(sp.sort ?? "") ? sp.sort : "createdAt") as OrgSortField;
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, countries] = await Promise.all([
    listOrganizations({
      q: q || undefined,
      status: status || undefined,
      country: country || undefined,
      sort,
      dir,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    listOrganizationCountries(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build query strings preserving every other param
  const qs = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, status, country, sort, dir, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "sort" && v === "createdAt") && !(k === "dir" && v === "desc")) params.set(k, v);
    const s = params.toString();
    return `/saas/organizations${s ? `?${s}` : ""}`;
  };

  const sortHref = (field: OrgSortField) => qs({ sort: field, dir: sort === field && dir === "desc" ? "asc" : "desc", page: undefined });
  const hasFilters = Boolean(q || status || country);
  const canManage = hasSaasPerm(user, "CUSTOMER_MANAGE");

  const th = (field: OrgSortField, label: string) => (
    <th className="px-3 py-2">
      <Link href={sortHref(field)} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
        {label}
        <span className="text-[9px]">{sort === field ? (dir === "desc" ? "▼" : "▲") : "↕"}</span>
      </Link>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} customer{total === 1 ? "" : "s"}
            {page > 1 ? ` · page ${page} of ${totalPages}` : ""}
          </p>
        </div>
        {canManage && <NewOrgModal />}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <form action="/saas/organizations" method="GET" className="flex max-w-md gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {country && <input type="hidden" name="country" value={country} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search legal or business name…"
            aria-label="Search organizations"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900">
            Search
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={qs({ status: undefined, page: undefined })} active={!status}>All</FilterChip>
          {ORG_STATUSES.map((s) => (
            <FilterChip key={s} href={qs({ status: s, page: undefined })} active={status === s}>
              {s}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <form action="/saas/organizations" method="GET" className="inline-flex items-center gap-2">
            {q && <input type="hidden" name="q" value={q} />}
            {status && <input type="hidden" name="status" value={status} />}
            <select
              name="country"
              defaultValue={country}
              aria-label="Country filter"
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold dark:border-zinc-700">Apply</button>
          </form>
          {hasFilters && (
            <Link href="/saas/organizations" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Clear all
            </Link>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <EmptyState
            title={hasFilters ? "No organizations match these filters" : "No organizations yet"}
            body={hasFilters ? "Try a different search term or clear the filters." : "Create your first SaaS customer organization."}
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  {th("legalName", "Organization")}
                  <th className="px-3 py-2">Country</th>
                  {th("healthScore", "Health")}
                  <th className="px-3 py-2">Status</th>
                  {th("mrr", "MRR")}
                  <th className="px-3 py-2">Primary contact</th>
                  {th("createdAt", "Created")}
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const primary = o.contacts.find((c) => c.isPrimary) ?? o.contacts[0];
                  return (
                    <tr key={o.id} className="border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                      <td className="px-3 py-2">
                        <Link href={`/saas/organizations/${o.id}`} className="font-semibold hover:text-indigo-600">{o.legalName}</Link>
                        {o.businessName && <span className="block text-xs text-zinc-400">{o.businessName}</span>}
                      </td>
                      <td className="px-3 py-2">{o.country || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 tabular-nums">
                          {o.healthScore ?? "—"}
                          {o.healthStatus && <StatusBadge domain="health" status={o.healthStatus} />}
                        </span>
                      </td>
                      <td className="px-3 py-2"><StatusBadge domain="organization" status={o.status} /></td>
                      <td className="px-3 py-2 tabular-nums">{money(o.mrr)}</td>
                      <td className="px-3 py-2 text-xs">{primary ? `${primary.name} · ${primary.email}` : "—"}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={`/saas/organizations/${o.id}`} className="block rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{o.legalName}</span>
                    <StatusBadge domain="organization" status={o.status} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{o.country || "—"}</span>
                    <span className="tabular-nums">{money(o.mrr)}/mo</span>
                    {o.healthStatus && <StatusBadge domain="health" status={o.healthStatus} />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
              {page > 1 && (
                <Link href={qs({ page: String(page - 1) })} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  ←
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                .map((n, idx, arr) => (
                  <span key={n} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span className="px-1 text-zinc-400">…</span>}
                    <Link
                      href={qs({ page: String(n) })}
                      aria-current={n === page ? "page" : undefined}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${n === page ? "bg-indigo-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
              {page < totalPages && (
                <Link href={qs({ page: String(page + 1) })} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
