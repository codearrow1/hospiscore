import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { listInvoices, listPayments } from "@/lib/saas/billing";
import { listOrganizations } from "@/lib/saas/organizations";
import BillingManager from "@/components/saas/BillingManager";
import { SectionCard, Badge, EmptyState } from "@/components/marketing-admin/ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BillingPage() {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Billing", "Platform access required.");
  const [{ items: invoices }, { items: payments }, { items: orgs }] = await Promise.all([listInvoices({ take: 50 }), listPayments({ take: 50 }), listOrganizations({ take: 100 })]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Billing</h1>
        <BillingManager orgs={orgs.map((o) => ({ id: o.id, legalName: o.legalName }))} />
      </div>
      <p className="text-xs text-zinc-500">Invoices are immutable (Draft→Paid→Refunded via gateway). Duplicate webhook protection via <code>idempotencyKey</code> — see <code>lib/saas/gateway.ts:14 createInvoice</code>.</p>
      <SectionCard title={`Invoices (${invoices.length})`}>
        {invoices.length === 0 ? <EmptyState title="No invoices yet" /> : (
          <table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-zinc-400"><th className="px-2 py-1">Org</th><th className="px-2 py-1">Type</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Amount</th><th className="px-2 py-1">Due</th></tr></thead><tbody>{invoices.map((i) => <tr key={i.id} className="border-t"><td className="px-2 py-1">{i.organization.legalName}</td><td className="px-2 py-1">{i.type}</td><td className="px-2 py-1"><Badge>{i.status}</Badge></td><td className="px-2 py-1">${(i.amount/100).toFixed(2)}</td><td className="px-2 py-1 text-xs">{i.dueAt ? new Date(i.dueAt).toLocaleDateString() : "—"}</td></tr>)}</tbody></table>
        )}
      </SectionCard>
      <SectionCard title={`Payments (${payments.length})`}>
        {payments.length === 0 ? <EmptyState title="No payments yet" /> : (
          <table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-zinc-400"><th className="px-2 py-1">Org</th><th className="px-2 py-1">Gateway</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Amount</th></tr></thead><tbody>{payments.map((p) => <tr key={p.id} className="border-t"><td className="px-2 py-1">{p.organization.legalName}</td><td className="px-2 py-1">{p.gateway}</td><td className="px-2 py-1"><Badge>{p.status}</Badge></td><td className="px-2 py-1">${(p.amount/100).toFixed(2)}</td></tr>)}</tbody></table>
        )}
      </SectionCard>
    </div>
  );
}
