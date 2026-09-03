/**
 * SaaS Usage & Metering — Phase E
 * Tracks properties, users, bookings, api_calls, storage etc. vs plan limits.
 * Provides current usage, remaining, pct, and 80/90/100% alerts. Enforces server-side.
 */

import { prisma } from "@/lib/prisma";

export type UsageMetric = "properties" | "users" | "bookings" | "api_calls" | "storage" | "emails" | "sms" | "whatsapp" | "automations";

export interface UsageSnapshot {
  metric: UsageMetric;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  pct: number | null; // 0-100
  overage: number;
  alert: "ok" | "80" | "90" | "100" | "over";
}

export function getPlanLimit(plan: { maxProperties?: number | null; maxUsers?: number | null; maxBookings?: number | null; storageGb?: number | null; features?: unknown }, metric: UsageMetric): number | null {
  switch (metric) {
    case "properties": return plan.maxProperties ?? null;
    case "users": return plan.maxUsers ?? null;
    case "bookings": return plan.maxBookings ?? null;
    case "storage": return plan.storageGb != null ? plan.storageGb * 1024 : null; // MB
    default: return null;
  }
}

export async function getUsage(organizationId: string): Promise<UsageSnapshot[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      properties: true,
      contacts: true,
      subscriptions: { where: { status: { in: ["active", "trial", "past_due", "grace"] } }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!org) throw new Error("Organization not found");
  const plan = org.subscriptions[0]?.plan ?? null;
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM

  // For metrics backed by UsageRecord, aggregate at DB level instead of loading all rows
  const usageAgg = await prisma.usageRecord.groupBy({
    by: ["metric"],
    where: { organizationId, period },
    _sum: { quantity: true },
  });
  const usageByMetric = new Map(usageAgg.map((r) => [r.metric, r._sum.quantity ?? 0]));

  const metrics: UsageMetric[] = ["properties","users","bookings","api_calls","storage","emails","sms","whatsapp","automations"];
  return metrics.map((metric) => {
    let used: number;
    if (metric === "properties") used = org.properties.length;
    else if (metric === "users") used = org.contacts.length;
    else used = usageByMetric.get(metric) ?? 0;

    const limit = plan ? getPlanLimit(plan as never, metric) : null;
    const pct = limit != null && limit > 0 ? Math.round((used / limit) * 100) : null;
    const remaining = limit != null ? Math.max(0, limit - used) : null;
    const overage = limit != null && used > limit ? used - limit : 0;
    let alert: UsageSnapshot["alert"] = "ok";
    if (overage > 0) alert = "over";
    else if (pct != null && pct >= 100) alert = "100";
    else if (pct != null && pct >= 90) alert = "90";
    else if (pct != null && pct >= 80) alert = "80";
    return { metric, used, limit, remaining, pct, overage, alert };
  });
}

export async function checkLimit(organizationId: string, metric: UsageMetric, increment = 1): Promise<{ allowed: boolean; snapshot: UsageSnapshot }> {
  const snapshots = await getUsage(organizationId);
  const snap = snapshots.find((s) => s.metric === metric);
  if (!snap) throw new Error("Unknown metric");
  if (snap.limit == null) return { allowed: true, snapshot: snap };
  return { allowed: snap.used + increment <= snap.limit, snapshot: snap };
}

export async function enforceLimit(organizationId: string, metric: UsageMetric, increment = 1): Promise<void> {
  const { allowed, snapshot } = await checkLimit(organizationId, metric, increment);
  if (!allowed) {
    throw new Error(`Quota exceeded: ${metric} ${snapshot.used}/${snapshot.limit} (over by ${snapshot.overage + increment})`);
  }
}

export async function recordUsage(organizationId: string, metric: UsageMetric, quantity = 1, period?: string) {
  const p = period ?? new Date().toISOString().slice(0, 7);
  return prisma.usageRecord.create({ data: { organizationId, metric, quantity, period: p } });
}

export async function usageHistory(organizationId: string, months = 6) {
  const clamped = Math.min(Math.max(1, months), 24);
  return prisma.usageRecord.findMany({
    where: { organizationId },
    orderBy: { recordedAt: "desc" },
    take: clamped * 10,
  });
}
