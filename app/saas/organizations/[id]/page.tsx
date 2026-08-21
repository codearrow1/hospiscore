import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { getOrganization } from "@/lib/saas/organizations";
import { SectionCard, Badge } from "@/components/marketing-admin/ui";
import PropertyModal from "@/components/saas/PropertyModal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Organization", "Platform access required.");
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const tab = sp.tab ?? "overview";
  const org = await getOrganization(id);
  if (!org) notFound();
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "properties", label: `Properties (${org.properties.length})` },
    { id: "subscriptions", label: `Subscriptions (${org.subscriptions.length})` },
    { id: "billing", label: `Billing (${org.invoices.length})` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{org.legalName}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {org.businessName || "—"} · {org.country || "—"} · <Badge>{org.status}</Badge> · MRR ${(org.mrr / 100).toFixed(2)} · Health {org.healthScore ?? "—"}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b pb-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/saas/organizations/${id}?tab=${t.id}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t.id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
          >
            {t.label}
          </Link>
        ))}
        <Link href="/saas/organizations" className="ml-auto text-xs font-medium text-zinc-500">
          ← Back to Organizations
        </Link>
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Contacts">
            {org.contacts.length === 0 ? <p className="text-sm text-zinc-500">No contacts</p> : <ul className="space-y-2 text-sm">{org.contacts.map((c) => <li key={c.id} className="flex justify-between"><span>{c.name} &lt;{c.email}&gt;</span>{c.isPrimary && <Badge>Primary</Badge>}</li>)}</ul>}
          </SectionCard>
          <SectionCard title="Organization">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Legal</dt><dd className="font-medium">{org.legalName}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Business</dt><dd>{org.businessName || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Country</dt><dd>{org.country || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Industry</dt><dd>{org.industry || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Website</dt><dd>{org.website || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Created</dt><dd>{new Date(org.createdAt).toLocaleString()}</dd></div>
            </dl>
          </SectionCard>
        </div>
      )}

      {tab === "properties" && (
        <SectionCard title="Properties (Tenants)" action={<PropertyModal organizationId={id} />}>
          {org.properties.length === 0 ? <p className="text-sm text-zinc-500">No properties yet — add the customer&apos;s PMS instances. These are SaaS tenant references, not hotel operational data.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase text-zinc-400"><th className="py-1">Name</th><th className="py-1">City</th><th className="py-1">Country</th><th className="py-1">Rooms</th><th className="py-1">Status</th></tr></thead>
              <tbody>{org.properties.map((p) => <tr key={p.id} className="border-t"><td className="py-1 font-medium">{p.name}</td><td className="py-1">{p.city || "—"}</td><td className="py-1">{p.country || "—"}</td><td className="py-1">{p.rooms ?? "—"}</td><td className="py-1"><Badge>{p.status}</Badge></td></tr>)}</tbody>
            </table>
          )}
        </SectionCard>
      )}

      {tab === "subscriptions" && (
        <SectionCard title="Subscriptions">
          {org.subscriptions.length === 0 ? <p className="text-sm text-zinc-500">No subscriptions — create via API or Plans page.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase text-zinc-400"><th className="py-1">Plan</th><th className="py-1">Cycle</th><th className="py-1">Status</th><th className="py-1">MRR</th><th className="py-1">Period</th></tr></thead>
              <tbody>{org.subscriptions.map((s) => <tr key={s.id} className="border-t"><td className="py-1">{s.plan.name}</td><td className="py-1">{s.billingCycle}</td><td className="py-1"><Badge>{s.status}</Badge></td><td className="py-1">${(s.mrr / 100).toFixed(2)}</td><td className="py-1 text-xs">{new Date(s.currentPeriodStart).toLocaleDateString()} → {new Date(s.currentPeriodEnd).toLocaleDateString()}</td></tr>)}</tbody>
            </table>
          )}
        </SectionCard>
      )}

      {tab === "billing" && (
        <SectionCard title="Invoices">
          {org.invoices.length === 0 ? <p className="text-sm text-zinc-500">No invoices.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase text-zinc-400"><th>Type</th><th>Status</th><th>Amount</th><th>Due</th></tr></thead>
              <tbody>{org.invoices.map((i) => <tr key={i.id} className="border-t"><td className="py-1">{i.type}</td><td className="py-1"><Badge>{i.status}</Badge></td><td className="py-1">${(i.amount / 100).toFixed(2)} {i.currency}</td><td className="py-1 text-xs">{i.dueAt ? new Date(i.dueAt).toLocaleDateString() : "—"}</td></tr>)}</tbody>
            </table>
          )}
        </SectionCard>
      )}
    </div>
  );
}
