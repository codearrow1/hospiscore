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
import ClaimVerifyControl from "@/components/saas/ClaimVerifyControl";
import { getOnboardingStatus } from "@/lib/saas/onboarding";

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

  const [org, subscription, invoices, usage, claims, onboarding] = await Promise.all([
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
    prisma.propertyClaim.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getOnboardingStatus(orgId),
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
      <CustomerPortalClient
        orgLabel={[org.businessName || org.legalName, org.country].filter(Boolean).join(" · ")}
        healthStatus={org.healthStatus || org.status}
        subscription={sub}
        outstandingCents={outstandingCents}
        usage30d={usage.map((u) => ({ metric: u.metric, quantity: u._sum.quantity ?? 0 }))}
        invoices={invoiceList}
      />
      {claims.some((c) => c.status === "approved") && !onboarding.complete && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Your listing is verified — finish setting up
              </h2>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                Your claim was approved. Complete the steps below to activate your account.
              </p>
            </div>
            <a
              href="#getting-started"
              className={"shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm " + "bg-emerald-600 hover:bg-emerald-700"}
            >
              Complete setup
            </a>
          </div>
        </section>
      )}
      <div id="getting-started" className="scroll-mt-24">
        <OnboardingChecklist title="Getting started" />
      </div>
      {claims.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Property claims</h2>
          <ul className="mt-3 space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">{c.propertyName}</p>
                  <p className="truncate text-xs text-zinc-500">{c.placeId}</p>
                </div>
                {c.status === "pending" ? (
                  <ClaimVerifyControl
                    claimId={c.id}
                    verified={c.verified}
                    verificationMethod={c.verificationMethod}
                  />
                ) : (
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                      (c.status === "approved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300")
                    }
                  >
                    {c.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
