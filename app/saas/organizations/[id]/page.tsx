import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getOrganization } from "@/lib/saas/organizations";
import { computeHealth } from "@/lib/saas/health";
import { listAuditLogs } from "@/lib/saas/audit";
import { hasSaasPerm } from "@/lib/saas/roles";
import { formatDateTime, formatMoney } from "@/lib/format";
import { SectionCard, StatusBadge } from "@/components/ui";
import PropertyModal from "@/components/saas/PropertyModal";
import { OrgActions, Org360Tables } from "@/components/saas/Org360";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TAB_IDS = ["overview", "properties", "subscriptions", "billing", "activity"] as const;

export default async function OrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Organization", "Platform access required.");
  const user = guard.user;
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const tab = TAB_IDS.includes((sp.tab ?? "") as never) ? sp.tab! : "overview";

  let org = await getOrganization(id);
  if (!org) notFound();
  // refresh health on each view (cheap, real signals only)
  try { await computeHealth(id); org = (await getOrganization(id)) ?? org; } catch {}

  const canManage = hasSaasPerm(user, "CUSTOMER_MANAGE");
  const activity = tab === "activity"
    ? await listAuditLogs({ targetType: "organization", targetId: id, take: 30 })
    : { items: [], total: 0 };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "properties", label: `Properties (${org.properties.length})` },
    { id: "subscriptions", label: `Subscriptions (${org.subscriptions.length})` },
    { id: "billing", label: `Billing (${org.invoices.length})` },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.legalName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{org.businessName || "—"} · {org.country || "—"}</span>
            <StatusBadge domain="organization" status={org.status} />
            <span className="tabular-nums">${(org.mrr / 100).toFixed(2)} MRR</span>
            <span>Health {org.healthScore ?? "—"}</span>
            {org.healthStatus && <StatusBadge domain="health" status={org.healthStatus} />}
          </p>
        </div>
        <OrgActions orgId={id} status={org.status} canManage={canManage} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 pb-2 dark:border-zinc-800">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/saas/organizations/${id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t.id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
          >
            {t.label}
          </Link>
        ))}
        <Link href="/saas/organizations" className="ml-auto text-xs font-medium text-zinc-500 hover:text-indigo-600">
          ← Back to Organizations
        </Link>
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Contacts">
            {org.contacts.length === 0 ? (
              <p className="text-sm text-zinc-500">No contacts</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {org.contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{c.name} &lt;{c.email}&gt;{c.phone ? ` · ${c.phone}` : ""}</span>
                    {c.isPrimary && <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">PRIMARY</span>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Organization">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Legal</dt><dd className="font-medium">{org.legalName}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Business</dt><dd>{org.businessName || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Country</dt><dd>{org.country || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Industry</dt><dd>{org.industry || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Website</dt><dd>{org.website || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Created</dt><dd>{formatDateTime(org.createdAt)}</dd></div>
            </dl>
          </SectionCard>
        </div>
      )}

      {tab === "properties" && (
        <SectionCard title="Properties (Tenants)" action={<PropertyModal organizationId={id} />}>
          <Org360Tables
            properties={org.properties.map((p) => ({ id: p.id, name: p.name, city: p.city, country: p.country, rooms: p.rooms, status: p.status }))}
            subscriptions={[]}
            invoices={[]}
          />
        </SectionCard>
      )}

      {tab === "subscriptions" && (
        <SectionCard title="Subscriptions">
          {org.subscriptions.length === 0 ? (
            <p className="text-sm text-zinc-500">No subscriptions — create via API or Subscriptions page.</p>
          ) : null}
          <Org360Tables
            properties={[]}
            subscriptions={org.subscriptions.map((s) => ({
              id: s.id,
              planName: s.plan.name,
              billingCycle: s.billingCycle,
              status: s.status,
              mrrLabel: `$${(s.mrr / 100).toFixed(2)}`,
              periodStart: new Date(s.currentPeriodStart).toLocaleDateString(),
              periodEnd: new Date(s.currentPeriodEnd).toLocaleDateString(),
            }))}
            invoices={[]}
          />
        </SectionCard>
      )}

      {tab === "billing" && (
        <SectionCard title="Invoices">
          <Org360Tables
            properties={[]}
            subscriptions={[]}
            invoices={org.invoices.map((i) => ({
              id: i.id,
              type: i.type,
              status: i.status,
              amountLabel: formatMoney(i.amount, i.currency),
              dueAt: i.dueAt ? new Date(i.dueAt).toLocaleDateString() : null,
              createdAt: formatDateTime(i.createdAt),
            }))}
          />
        </SectionCard>
      )}

      {tab === "activity" && (
        <SectionCard title="Activity — audit trail for this organization">
          {activity.items.length === 0 ? (
            <p className="text-sm text-zinc-500">No recorded activity yet. Actions taken on this organization (status changes, property edits, subscription transitions) appear here.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800/70">
              {activity.items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{a.action}</span>
                  <span className="min-w-0 flex-1 truncate px-2 text-xs text-zinc-500 dark:text-zinc-400">{a.actorEmail}</span>
                  <span className="text-xs text-zinc-400">{formatDateTime(a.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
