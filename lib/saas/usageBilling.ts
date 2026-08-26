/**
 * Usage overage billing (M-08).
 *
 * No metered prices exist in the plan catalog today, so this job is INERT
 * until an admin configures rates via the `usage_overage_rates` SystemSetting:
 *   { "api_calls": 2, "emails": 5, "sms": 40 }   // minor units per unit used
 *
 * Each (org, metric, period) is billed at most once — markers live in the
 * `usage_billed_periods` SystemSetting KV so no schema change is required.
 *
 * Settings (via Settings Resolver):
 * - usage_invoice_due_days: Days until usage invoice is due [default: 14]
 */
import { prisma } from "@/lib/prisma";
import { resolveSetting } from "@/lib/settings/resolver";

const RATES_KEY = "usage_overage_rates";
const BILLED_KEY = "usage_billed_periods";

/** Pure: keep only finite non-negative numeric entries keyed by known-ish metric slugs. */
export function coerceUsageRates(v: unknown): Record<string, number> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z_]{2,32}$/.test(k)) continue;
    const n = typeof val === "number" ? val : Number(val);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

/** Pure: total charge in minor units for aggregated quantity. */
export function usageChargeMinor(quantity: number, ratePerUnitMinor: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(ratePerUnitMinor)) return 0;
  if (quantity <= 0 || ratePerUnitMinor <= 0) return 0;
  return Math.round(quantity * ratePerUnitMinor);
}

/**
 * Bill the previous month's metered usage. Idempotent per (org, metric,
 * period); inert while no rates are configured. The whole sweep — rate
 * config read, aggregation, marker check, invoice creation, marker write —
 * runs in ONE transaction, so concurrent cron executions serialize instead
 * of double-invoicing (SQLite single-writer + snapshot isolation).
 */
export async function billUsagePeriod(opts?: { period?: string; actorEmail?: string }): Promise<{
  billedInvoices: number;
  billedTotalMinor: number;
  skippedAlreadyBilled: number;
  ratesConfigured: boolean;
}> {
  const period = opts?.period ?? previousMonthPeriod();
  const actorEmail = opts?.actorEmail ?? "system:cron";
  const { createInvoice } = await import("./gateway");

  return prisma.$transaction(async (tx) => {
    // Take the DB write lock immediately: every later read in this
    // transaction observes the latest committed state, and a concurrent sweep
    // blocks here instead of double-billing against a stale marker map.
    await tx.systemSetting.upsert({
      where: { key: BILLED_KEY },
      update: { updatedAt: new Date() },
      create: { key: BILLED_KEY, value: {} as never, updatedByEmail: "system:cron" },
    });
    const ratesRow = await tx.systemSetting.findUnique({ where: { key: RATES_KEY } });
    const rates = coerceUsageRates(ratesRow?.value ?? {});
    if (Object.keys(rates).length === 0) {
      return { billedInvoices: 0, billedTotalMinor: 0, skippedAlreadyBilled: 0, ratesConfigured: false };
    }

    const billedRow = await tx.systemSetting.findUnique({ where: { key: BILLED_KEY } });
    const billedMap = ((billedRow?.value ?? {}) as Record<string, string>) || {};
    let mapDirty = false;

    const groups = await tx.usageRecord.groupBy({
      by: ["organizationId", "metric"],
      where: { period },
      _sum: { quantity: true },
    });

    // One invoice per org covering all billable metrics in the period.
    const byOrg = new Map<string, { metric: string; qty: number; amount: number }[]>();
    let skippedAlreadyBilled = 0;
    for (const g of groups) {
      const rate = rates[g.metric];
      if (!rate || rate <= 0) continue;
      const marker = `${g.organizationId}|${g.metric}|${period}`;
      if (billedMap[marker]) {
        skippedAlreadyBilled += 1;
        continue;
      }
      const qty = g._sum.quantity ?? 0;
      const amount = usageChargeMinor(qty, rate);
      if (amount <= 0) continue;
      const list = byOrg.get(g.organizationId) ?? [];
      list.push({ metric: g.metric, qty, amount });
      byOrg.set(g.organizationId, list);
    }

    let billedInvoices = 0;
    let billedTotalMinor = 0;
    
    // Get invoice due days from settings
    let invoiceDueDays = 14;
    try {
      invoiceDueDays = await resolveSetting<number>("usage_invoice_due_days");
    } catch {
      // Use default
    }

    for (const [orgId, items] of byOrg) {
      const sub = await tx.subscription.findFirst({
        where: { organizationId: orgId, status: { in: ["active", "past_due", "grace"] } },
        orderBy: { createdAt: "desc" },
        select: { currency: true },
      });
      const total = items.reduce((s, l) => s + l.amount, 0);
      if (total <= 0) continue;
      try {
        const inv = await createInvoice(
          {
            organizationId: orgId,
            amount: total,
            currency: sub?.currency || "USD",
            type: "usage",
            dueAt: new Date(Date.now() + invoiceDueDays * 86_400_000),
            actorEmail,
          },
          tx,
        );
        billedInvoices += 1;
        billedTotalMinor += total;
        for (const l of items) billedMap[`${orgId}|${l.metric}|${period}`] = inv.id;
        mapDirty = true;
      } catch {
        // Leave markers unset so the next sweep retries this org.
      }
    }

    if (mapDirty) {
      await tx.systemSetting.upsert({
        where: { key: BILLED_KEY },
        update: { value: billedMap as never, updatedAt: new Date() },
        create: { key: BILLED_KEY, value: billedMap as never, updatedByEmail: "system" },
      });
    }

    return { billedInvoices, billedTotalMinor, skippedAlreadyBilled, ratesConfigured: true };
  }, { maxWait: 20_000, timeout: 60_000 });
}

function previousMonthPeriod(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}
