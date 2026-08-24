import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { resolveAppRole } from "@/lib/rbac";
import { initSaasDb } from "@/lib/saas/init";
import { resolveOrgForUser } from "@/lib/saas/portalAccess";
import CustomerPortalClient, {
  type PortalInvoice,
  type PortalSubscription,
} from "@/components/saas/CustomerPortalClient";
import OnboardingChecklist from "@/components/saas/OnboardingChecklist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Customer portal — own organization, subscription, billing, usage and self-service. */
export default async function CustomerPortal() {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/customer");
  await initSaasDb().catch(() => {});

  const resolved = await resolveOrgForUser(user);
  if (!resolved) {
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

  const orgId = resolved.organizationId;
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [org, subscription, invoices, usage] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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

  if (!org) redirect("/account?next=/customer");

  // Prefer an active/trial sub; otherwise surface the most recent one so the
  // customer still sees plan context (e.g. after cancellation).
  const activeSub =
    (await prisma.subscription.findFirst({
      where: { organizationId: orgId, status: { in: ["active", "trial"] } },
      include: { plan: true },
    })) ?? subscription;

  const outstandingCents = invoices
    .filter((i) => ["issued", "past_due", "partially_paid"].includes(i.status))
    .reduce((s, i) => s + i.amount, 0);

  const sub: PortalSubscription | null = activeSub
    ? {
        planName: activeSub.plan.name,
        billingCycle: activeSub.billingCycle,
        mrrCents: activeSub.mrr,
        status: activeSub.status,
        periodStartISO: activeSub.currentPeriodStart ? new Date(activeSub.currentPeriodStart).toISOString() : null,
        periodEndISO: activeSub.currentPeriodEnd ? new Date(activeSub.currentPeriodEnd).toISOString() : null,
      }
    : null;

  const invoiceList: PortalInvoice[] = invoices.map((i) => ({
    id: i.id,
    createdAtISO: new Date(i.createdAt).toISOString(),
    type: i.type,
    status: i.status,
    amount: i.amount,
    currency: i.currency,
    dueAtISO: i.dueAt ? new Date(i.dueAt).toISOString() : null,
    paidAtISO: i.paidAt ? new Date(i.paidAt).toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <OnboardingChecklist title="Getting started" />
      <CustomerPortalClient
        orgLabel={[org.businessName || org.legalName, org.country].filter(Boolean).join(" · ")}
        healthStatus={org.healthStatus || org.status}
        subscription={sub}
        outstandingCents={outstandingCents}
        usage30d={usage.map((u) => ({ metric: u.metric, quantity: u._sum.quantity ?? 0 }))}
        invoices={invoiceList}
      />
    </div>
  );
}
