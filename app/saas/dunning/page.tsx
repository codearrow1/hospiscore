import { requireMarketingUser } from "@/lib/marketing/guard";
import { restrictedPanel } from "@/app/marketing-admin/restricted";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listDunningCases, dunningStageCounts, RETRY_SCHEDULE_DAYS } from "@/lib/saas/dunning";
import DunningManager, { type DunningCaseView } from "@/components/saas/DunningManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DunningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return restrictedPanel("Dunning", "Platform access required.");
  if (!hasSaasPerm(guard.user, "BILLING_VIEW")) return restrictedPanel("Dunning", "BILLING_VIEW required.");

  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "";
  const status = ["active", "recovered", "suspended", "given_up"].includes(raw) ? raw : "";

  const [counts, { items }] = await Promise.all([dunningStageCounts(), listDunningCases({ status: status || undefined })]);

  const cases: DunningCaseView[] = items.map((d) => ({
    id: d.id,
    orgId: d.organizationId,
    orgName: d.organization?.legalName ?? d.organizationId.slice(0, 8),
    orgCountry: d.organization?.country ?? null,
    invoiceId: d.invoiceId,
    invoiceAmountCents: d.invoice?.amount ?? null,
    invoiceCurrency: d.invoice?.currency ?? null,
    invoiceStatus: d.invoice?.status ?? null,
    attempt: d.attempt,
    maxAttempts: d.maxAttempts,
    nextRetryAt: d.nextRetryAt ? d.nextRetryAt.toISOString() : null,
    lastError: d.lastError,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  // Aging of open collections work, measured from case creation.
  const activeCases = cases.filter((c) => c.status === "active");
  const agingBuckets = [
    { label: "≤7d", min: 0, max: 7 },
    { label: "8–14d", min: 8, max: 14 },
    { label: "15–30d", min: 15, max: 30 },
    { label: "30d+", min: 31, max: Infinity },
  ].map((b) => ({
    ...b,
    count: activeCases.filter((c) => {
      const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
      return days >= b.min && days <= b.max;
    }).length,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dunning — failed payment recovery</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          When a payment fails, the invoice goes past due and a collection case opens. The retry ladder
          contacts the customer at day {RETRY_SCHEDULE_DAYS.join(", · day ")} after each failed attempt
          (max {RETRY_SCHEDULE_DAYS.length}); full settlement auto-recovers the case and reactivates the
          subscription. After the final attempt the subscription is suspended and the case is given up.
        </p>
      </div>
      <DunningManager cases={cases} counts={counts} currentStatus={status} aging={agingBuckets} />
    </div>
  );
}
