/**
 * Lifecycle automation — Phase M
 * Trigger rules evaluated from real data on each sweep; each rule has a
 * cooldown so an org is not spammed. Actions: email via lib/mailer + event log.
 * No SMS/WhatsApp unless a provider transport is added to lib/mailer.
 */
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

export const AUTOMATION_RULES = [
  "trial_expiring_3d",
  "trial_expired",
  "renewal_approaching_7d",
  "payment_failed",
  "usage_80",
  "usage_100",
  "customer_inactive_14d",
  "churn_risk_critical",
] as const;
export type AutomationRule = (typeof AUTOMATION_RULES)[number];

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COOLDOWN_DAYS: Record<AutomationRule, number> = {
  trial_expiring_3d: 3,
  trial_expired: 30,
  renewal_approaching_7d: 20,
  payment_failed: 2,
  usage_80: 7,
  usage_100: 7,
  customer_inactive_14d: 14,
  churn_risk_critical: 7,
};

const DAY = 86400000;

async function recentlySent(rule: AutomationRule, organizationId: string): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_DAYS[rule] * DAY);
  const ev = await prisma.automationEvent.findFirst({
    where: { rule, organizationId, status: { in: ["sent", "skipped"] }, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(ev);
}

async function emit(orgId: string | null, rule: AutomationRule, to: string | null, subject: string, html: string): Promise<"sent" | "failed" | "skipped"> {
  if (!to) return "skipped";
  if (orgId && (await recentlySent(rule, orgId))) return "skipped";
  try {
    await sendMail({ to, subject, html });
    await prisma.automationEvent.create({ data: { organizationId: orgId, rule, recipient: to, payload: subject.slice(0, 300), status: "sent" } });
    return "sent";
  } catch (e) {
    await prisma.automationEvent.create({ data: { organizationId: orgId, rule, recipient: to, payload: subject.slice(0, 300), status: "failed", error: e instanceof Error ? e.message.slice(0, 300) : "send failed" } });
    return "failed";
  }
}

async function primaryEmail(organizationId: string): Promise<string | null> {
  const c = await prisma.orgContact.findFirst({ where: { organizationId, isPrimary: true }, select: { email: true } })
    ?? await prisma.orgContact.findFirst({ where: { organizationId }, select: { email: true } });
  return c?.email ?? null;
}

/** Fire a single ad-hoc rule for an org (used by dunning etc.). Cooldown still applies. */
export async function fireRule(rule: AutomationRule, organizationId: string, context?: Record<string, string | number>): Promise<"sent" | "failed" | "skipped"> {
  const to = await primaryEmail(organizationId);
  const ctx = context ? Object.entries(context).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
  return emit(organizationId, rule, to, `HospiOS alert: ${rule.replace(/_/g, " ")}`, `<p>Rule <b>${rule}</b> triggered${ctx ? ` (${ctx})` : ""}.</p>`);
}

export async function runAutomationSweep(): Promise<{ evaluated: number; sent: Record<string, number> }> {
  const sent: Record<string, number> = {};
  const bump = (r: string) => { sent[r] = (sent[r] ?? 0) + 1; };
  let evaluated = 0;

  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["trial", "active"] } },
    include: { organization: { select: { id: true, legalName: true, healthStatus: true } } },
    take: 500,
  });

  for (const sub of subs) {
    evaluated++;
    const org = sub.organization;
    const to = await primaryEmail(org.id);
    const now = Date.now();

    if (sub.status === "trial" && sub.trialEndsAt) {
      const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - now) / DAY);
      if (daysLeft === 3 || daysLeft === 2) {
        const r = await emit(org.id, "trial_expiring_3d", to, "Your HospiOS trial ends soon", `<p>Hi ${escHtml(org.legalName)}, your trial ends in ${daysLeft} day(s).</p>`);
        if (r === "sent") bump("trial_expiring_3d");
      } else if (daysLeft <= 0) {
        const r = await emit(org.id, "trial_expired", to, "Your HospiOS trial has ended", `<p>Hi ${escHtml(org.legalName)}, your trial has ended. Choose a plan to continue.</p>`);
        if (r === "sent") bump("trial_expired");
      }
    }

    if (sub.status === "active") {
      const daysToRenew = Math.ceil((sub.currentPeriodEnd.getTime() - now) / DAY);
      if (daysToRenew >= 0 && daysToRenew <= 7) {
        const r = await emit(org.id, "renewal_approaching_7d", to, "Your HospiOS subscription renews soon", `<p>Hi ${escHtml(org.legalName)}, your subscription renews in ${daysToRenew} day(s).</p>`);
        if (r === "sent") bump("renewal_approaching_7d");
      }
    }

    if (org.healthStatus === "critical") {
      const r = await emit(org.id, "churn_risk_critical", to, "We're here to help", `<p>Hi ${escHtml(org.legalName)}, we noticed you may be facing challenges. Our team is ready to help.</p>`);
      if (r === "sent") bump("churn_risk_critical");
    }
  }

  // Usage thresholds across recent records
  const orgs = await prisma.organization.findMany({ select: { id: true, legalName: true }, take: 500 });
  for (const org of orgs) {
    evaluated++;
    const to = await primaryEmail(org.id);
    // latest usage per metric vs plan limit
    const sub = await prisma.subscription.findFirst({ where: { organizationId: org.id, status: { in: ["active", "past_due", "grace"] } }, include: { plan: true }, orderBy: { createdAt: "desc" } });
    if (!sub) continue;
    for (const metric of ["properties", "users", "bookings"] as const) {
      const agg = await prisma.usageRecord.aggregate({ where: { organizationId: org.id, metric }, _max: { quantity: true } });
      const used = agg._max?.quantity;
      if (used === null) continue;
      const limit = getLimit(sub.plan, metric);
      if (limit === null) continue;
      const pct = Math.round((used / limit) * 100);
      if (pct >= 100) {
        const r = await emit(org.id, "usage_100", to, `Usage limit reached: ${metric}`, `<p>Hi ${escHtml(org.legalName)}, you have reached 100% of your ${metric} limit (${used}/${limit}).</p>`);
        if (r === "sent") bump("usage_100");
      } else if (pct >= 80) {
        const r = await emit(org.id, "usage_80", to, `Usage warning: ${metric}`, `<p>Hi ${escHtml(org.legalName)}, you are at ${pct}% of your ${metric} limit (${used}/${limit}).</p>`);
        if (r === "sent") bump("usage_80");
      }
    }

    // inactive customer: no usage in 14+ days but has active sub
    const lastUsage = await prisma.usageRecord.findFirst({ where: { organizationId: org.id }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } });
    if (lastUsage && Date.now() - lastUsage.recordedAt.getTime() > 14 * DAY) {
      const r = await emit(org.id, "customer_inactive_14d", to, "We miss you at HospiOS", `<p>Hi ${escHtml(org.legalName)}, it's been over two weeks since your last activity.</p>`);
      if (r === "sent") bump("customer_inactive_14d");
    }
  }

  return { evaluated, sent };
}

function getLimit(plan: { maxProperties: number | null; maxUsers: number | null; maxBookings: number | null }, metric: "properties" | "users" | "bookings"): number | null {
  if (metric === "properties") return plan.maxProperties;
  if (metric === "users") return plan.maxUsers;
  return plan.maxBookings;
}

export async function listAutomationEvents(opts?: { rule?: string; organizationId?: string; take?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.rule) where.rule = opts.rule;
  if (opts?.organizationId) where.organizationId = opts.organizationId;
  const [items, total] = await Promise.all([
    prisma.automationEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: opts?.take ?? 100 }),
    prisma.automationEvent.count({ where }),
  ]);
  return { items, total };
}
