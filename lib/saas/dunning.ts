/**
 * Dunning — failed payment recovery — Phase K
 * Lifecycle: payment fails → case opens → retries at +1d, +3d, +5d, +7d
 * (max 4 attempts). Recovered on successful payment; after final failure the
 * subscription is suspended and the case is given up.
 * Emails go through lib/mailer (console transport in dev).
 */
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

export type DunningStatus = "active" | "recovered" | "suspended" | "given_up";
export const DUNNING_STATUSES: DunningStatus[] = ["active", "recovered", "suspended", "given_up"];

/** Retry schedule in days after each failed attempt (index = attempt number just made) */
export const RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];

export function nextRetryAfterAttempt(attempt: number, from = new Date()): Date | null {
  // After contact N, check again RETRY_SCHEDULE_DAYS[N-1] later; beyond the ladder there is no next check.
  if (attempt < 1 || attempt > RETRY_SCHEDULE_DAYS.length) return null;
  return new Date(from.getTime() + RETRY_SCHEDULE_DAYS[attempt - 1] * 86400000);
}

export async function startDunning(params: { invoiceId: string; organizationId: string; subscriptionId?: string | null; reason?: string }): Promise<{ caseId: string; resumed: boolean }> {
  const existing = await prisma.dunningCase.findFirst({ where: { invoiceId: params.invoiceId, status: "active" } });
  if (existing) return { caseId: existing.id, resumed: true };
  const dc = await prisma.dunningCase.create({
    data: {
      organizationId: params.organizationId,
      invoiceId: params.invoiceId,
      subscriptionId: params.subscriptionId ?? null,
      attempt: 1,
      nextRetryAt: nextRetryAfterAttempt(1),
      lastError: params.reason?.slice(0, 300) ?? null,
      status: "active",
    },
  });
  await notify(await orgPrimaryEmail(params.organizationId), `Payment failed — action needed`, dunningHtml(params.organizationId, 1));
  return { caseId: dc.id, resumed: false };
}

export async function recoverCase(invoiceId: string): Promise<boolean> {
  const dc = await prisma.dunningCase.findFirst({ where: { invoiceId, status: "active" } });
  if (!dc) return false;
  await prisma.dunningCase.update({ where: { id: dc.id }, data: { status: "recovered", nextRetryAt: null } });
  // restore subscription if it was downgraded by dunning
  if (dc.subscriptionId) {
    const sub = await prisma.subscription.findUnique({ where: { id: dc.subscriptionId }, select: { status: true } });
    // A case given up by the retry ladder suspends the subscription; a paying
    // customer must come back to active from that state too.
    if (sub && (sub.status === "past_due" || sub.status === "grace" || sub.status === "suspended")) {
      await prisma.subscription.update({ where: { id: dc.subscriptionId }, data: { status: "active" } });
      try {
        const { syncOrgMrr } = await import("./subscriptions");
        await syncOrgMrr(dc.organizationId);
      } catch {}
    }
  }
  return true;
}

export async function processDueCases(now = new Date()): Promise<{ processed: number; recovered: number; suspended: number }> {
  const due = await prisma.dunningCase.findMany({
    where: { status: "active", nextRetryAt: { lte: now } },
    include: { organization: { select: { legalName: true } } },
    take: 100,
  });
  let recovered = 0;
  let suspended = 0;
  for (const dc of due) {
    const invoice = await prisma.invoice.findUnique({ where: { id: dc.invoiceId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!invoice || invoice.status === "paid" || invoice.status === "void") {
      await prisma.dunningCase.update({ where: { id: dc.id }, data: { status: "recovered", nextRetryAt: null } });
      recovered++;
      continue;
    }
    const attempt = dc.attempt + 1;
    if (attempt > dc.maxAttempts) {
      await prisma.dunningCase.update({ where: { id: dc.id }, data: { status: "given_up", nextRetryAt: null } });
      if (dc.subscriptionId) {
        await prisma.subscription.updateMany({ where: { id: dc.subscriptionId, status: { in: ["past_due", "grace"] } }, data: { status: "suspended" } });
        try {
          const { syncOrgMrr } = await import("./subscriptions");
          await syncOrgMrr(dc.organizationId);
        } catch {}
      }
      suspended++;
      continue;
    }
    await prisma.dunningCase.update({
      where: { id: dc.id },
      data: { attempt, nextRetryAt: nextRetryAfterAttempt(attempt) },
    });
    await notify(await orgPrimaryEmail(dc.organizationId), `Reminder ${attempt}/${dc.maxAttempts}: invoice payment overdue`, dunningHtml(dc.organizationId, attempt));
  }
  return { processed: due.length, recovered, suspended };
}

export async function listDunningCases(opts?: { status?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  const items = await prisma.dunningCase.findMany({
    where,
    include: { organization: { select: { legalName: true, country: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });
  // DunningCase stores invoiceId without a Prisma relation — hydrate manually
  // so the UI can show amount/currency/status per case.
  const invoiceIds = [...new Set(items.map((d) => d.invoiceId))];
  const invoices = invoiceIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, amount: true, currency: true, status: true, dueAt: true, createdAt: true },
      })
    : [];
  const byId = new Map(invoices.map((i) => [i.id, i]));
  return {
    items: items.map((d) => ({ ...d, invoice: byId.get(d.invoiceId) ?? null })),
    total: items.length,
  };
}

/** Per-stage counts for the dunning triage chips. */
export async function dunningStageCounts(): Promise<Record<string, number>> {
  const rows = await prisma.dunningCase.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

async function orgPrimaryEmail(organizationId: string): Promise<string | null> {
  const contact = await prisma.orgContact.findFirst({ where: { organizationId, isPrimary: true }, select: { email: true } })
    ?? await prisma.orgContact.findFirst({ where: { organizationId }, select: { email: true } });
  return contact?.email ?? null;
}

async function notify(to: string | null, subject: string, html: string): Promise<void> {
  if (!to) return;
  try {
    await sendMail({ to, subject, html });
  } catch {}
}

function dunningHtml(orgName: string, attempt: number): string {
  return `<p>Hi ${orgName},</p><p>This is reminder ${attempt} regarding your failed payment. Please update your billing details to avoid service suspension.</p>`;
}
