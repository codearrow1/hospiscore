import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { SectionCard, Badge, EmptyState } from "@/components/marketing-admin/ui";
import { resolveAppRole } from "@/lib/rbac";
import { initSaasDb } from "@/lib/saas/init";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Customer portal — own organization, subscription, billing and usage. */
export default async function CustomerPortal() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/customer");
  await initSaasDb().catch(() => {});

  const contact = await prisma.orgContact.findFirst({
    where: { email: user.email, organization: { status: { not: "cancelled" } } },
    orderBy: { isPrimary: "desc" },
    include: { organization: true },
  });
  if (!contact) {
    const appRole = await resolveAppRole(user);
    if (appRole !== "super_admin") redirect("/account?next=/customer");
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <h1 className="text-2xl font-bold">Customer Portal</h1>
        <p className="mt-2 text-sm text-zinc-600">
          No customer account found for {user.email}. Contact your account manager to get set up.
        </p>
      </div>
    );
  }

  const org = contact.organization;
  const orgId = org.id;
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [subscriptions, invoices, usage] = await Promise.all([
    prisma.subscription.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.usageRecord.groupBy({
      by: ["metric"],
      where: { organizationId: orgId, recordedAt: { gte: since } },
      _sum: { quantity: true },
    }),
  ]);

  const active = subscriptions.find((s) => s.status === "active" || s.status === "trial") ?? subscriptions[0];
  const outstanding = invoices
    .filter((i) => i.status === "issued" || i.status === "past_due" || i.status === "partially_paid")
    .reduce((s, i) => s + i.amount, 0);
  const needsPayment = outstanding > 0;
  const subAttention = active && ["past_due", "grace"].includes(active.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customer Portal</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {org.businessName || org.legalName}
              {org.country ? ` · ${org.country}` : ""}
            </p>
          </div>
          <Badge>{org.healthStatus || org.status}</Badge>
        </div>

        {(needsPayment || subAttention) && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            {needsPayment && (
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Action needed: outstanding balance {money(outstanding)} — <a href="#billing" className="underline">view billing</a>
              </p>
            )}
            {subAttention && (
              <p className={`text-sm font-semibold text-amber-800 dark:text-amber-200 ${needsPayment ? "mt-1" : ""}`}>
                Your subscription is {active!.status} — update your payment method to avoid interruption.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Plan</p>
            <p className="mt-1 text-lg font-semibold">{active ? active.plan.name : "—"}</p>
            {active ? <p className="text-xs text-zinc-500">{active.billingCycle}</p> : null}
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">MRR</p>
            <p className="mt-1 text-2xl font-semibold">{money(org.mrr)}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Outstanding</p>
            <p className="mt-1 text-2xl font-semibold">{money(outstanding)}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Usage (30d)</p>
            <p className="mt-1 text-2xl font-semibold">{usage.reduce((s, u) => s + (u._sum.quantity ?? 0), 0).toLocaleString()}</p>
          </SectionCard>
        </div>

        <SectionCard title="Subscription">
          <div id="subscription" />
          {!active ? (
            <EmptyState title="No subscription yet." />
          ) : (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">{active.plan.name}</span>{" "}
                <span className="text-zinc-500">({active.billingCycle})</span> —{" "}
                {money(active.mrr)}/mo
              </p>
              <p className="text-zinc-500">
                Current period: {new Date(active.currentPeriodStart).toLocaleDateString()} →{" "}
                {new Date(active.currentPeriodEnd).toLocaleDateString()}
              </p>
              <Badge>{active.status}</Badge>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Usage by metric (last 30 days)">
          <div id="usage" />
          {usage.length === 0 ? (
            <EmptyState title="No usage recorded." />
          ) : (
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {usage.map((u) => (
                <li key={u.metric} className="rounded-md border border-zinc-200 px-2 py-1.5">
                  <span className="font-medium">{(u._sum.quantity ?? 0).toLocaleString()}</span>{" "}
                  <span className="text-zinc-500">{u.metric}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Billing history">
          <div id="billing" />
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet." />
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <span className="text-zinc-600">
                    {new Date(i.createdAt).toLocaleDateString()} · {i.type}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{money(i.amount)}</span>
                    <Badge>{i.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
  );
}
