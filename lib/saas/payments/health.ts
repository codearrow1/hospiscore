/**
 * Provider health — measured, never guessed. Health sweeps update a per-provider
 * ledger and surface success rate / consecutive failures to the settings UI.
 */
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { getProviderConfig, getProviderConfigs, getRawProviderConfigs } from "./store";

export interface HealthView {
  providerId: string;
  healthy: boolean;
  lastCheckedAt: number | null;
  lastError: string | null;
  successRate: number | null;
  consecutiveFailures: number;
  totalCalls: number;
}

/** Record a reconciliation/connection outcome against a provider. */
export async function recordProviderOutcome(opts: {
  providerId: string;
  ok: boolean;
  error?: string | null;
  actorEmail?: string;
}): Promise<void> {
  const row = await prisma.paymentProviderHealth.upsert({
    where: { providerId: opts.providerId },
    create: {
      providerId: opts.providerId,
      healthy: opts.ok,
      lastCheckedAt: new Date(),
      lastError: opts.error ?? null,
      successCount: opts.ok ? 1 : 0,
      failureCount: opts.ok ? 0 : 1,
    },
    update: {
      healthy: opts.ok,
      lastCheckedAt: new Date(),
      lastError: opts.error ?? null,
      successCount: { increment: opts.ok ? 1 : 0 },
      failureCount: { increment: opts.ok ? 0 : 1 },
    },
  });
  // Update the configured provider's health field (SystemSetting) without
  // touching any credentials.
  const prevFailures = (await getProviderConfig(opts.providerId))?.health?.consecutiveFailures ?? 0;
  const consecutiveFailures = opts.ok ? 0 : prevFailures + 1;
  await setHealthInStore(opts.providerId, {
    healthy: opts.ok,
    lastCheckedAt: Date.now(),
    lastError: opts.error ?? null,
    successRate: row.successCount + row.failureCount > 0 ? row.successCount / (row.successCount + row.failureCount) : null,
    consecutiveFailures,
  });
  if (opts.actorEmail) {
    await writeSaasAudit({ byEmail: opts.actorEmail, action: "payments.provider_health", entity: "payment_provider", entityId: opts.providerId, detail: opts.ok ? "healthy" : `degraded: ${opts.error ?? ""}` });
  }
}

async function setHealthInStore(providerId: string, health: Record<string, unknown>): Promise<void> {
  const raw = await getRawProviderConfigs();
  const cfg = raw[providerId];
  if (!cfg) return;
  cfg.health = { ...(cfg.health ?? {}), ...health };
  await prisma.systemSetting.upsert({
    where: { key: "payment_providers" },
    create: { key: "payment_providers", value: raw as never, updatedAt: new Date() },
    update: { value: raw as never, updatedAt: new Date() },
  });
}

/** Full health view for all configured providers. */
export async function listProviderHealth(): Promise<HealthView[]> {
  const configs = await getProviderConfigs(true);
  const rows = await prisma.paymentProviderHealth.findMany();
  const map = new Map(rows.map((r) => [r.providerId, r]));
  const configured = new Set(configs.map((c) => c.id));
  const out: HealthView[] = [];
  for (const cfg of configs) {
    const row = map.get(cfg.id);
    out.push({
      providerId: cfg.id,
      healthy: Boolean(row?.healthy) && cfg.health?.consecutiveFailures === 0,
      lastCheckedAt: row?.lastCheckedAt?.getTime() ?? cfg.health?.lastCheckedAt ?? null,
      lastError: row?.lastError ?? cfg.health?.lastError ?? null,
      successRate: cfg.health?.successRate ?? (row && row.successCount + row.failureCount > 0 ? row.successCount / (row.successCount + row.failureCount) : null),
      consecutiveFailures: cfg.health?.consecutiveFailures ?? 0,
      totalCalls: row ? row.successCount + row.failureCount : 0,
    });
  }
  if (out.length === 0) {
    for (const c of Array.from(configured)) {
      out.push({ providerId: c, healthy: false, lastCheckedAt: null, lastError: null, successRate: null, consecutiveFailures: 0, totalCalls: 0 });
    }
  }
  return out;
}

export interface WebhookHealthView {
  providerId: string;
  totalEvents: number;
  lastWebhookAt: number | null;
  lastStatus: string | null;
  lastFailureAt: number | null;
  lastFailureNote: string | null;
  failures: number;
  verified: number;
  reconciled: number;
  pending: number;
  ignored: number;
}

/**
 * Aggregate real per-provider webhook health from the append-only
 * PaymentWebhookLog. This is a genuinely separate signal from connection
 * health: it reflects what the provider has actually delivered and confirmed.
 * Payloads are never exposed here (only counts + timestamps/notes).
 */
export async function listWebhookHealth(providerId?: string): Promise<WebhookHealthView[]> {
  const rows = await prisma.paymentWebhookLog.findMany({
    where: providerId ? { provider: providerId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  const byProvider = new Map<string, WebhookHealthView>();
  for (const r of rows) {
    let v = byProvider.get(r.provider);
    if (!v) {
      v = {
        providerId: r.provider,
        totalEvents: 0,
        lastWebhookAt: null,
        lastStatus: null,
        lastFailureAt: null,
        lastFailureNote: null,
        failures: 0,
        verified: 0,
        reconciled: 0,
        pending: 0,
        ignored: 0,
      };
      byProvider.set(r.provider, v);
    }
    v.totalEvents += 1;
    if (v.lastWebhookAt === null) v.lastWebhookAt = r.createdAt.getTime();
    if (v.lastStatus === null) v.lastStatus = r.status;
    switch (r.status) {
      case "failed": v.failures += 1; if (v.lastFailureAt === null) v.lastFailureAt = r.createdAt.getTime(); if (v.lastFailureNote === null) v.lastFailureNote = r.verificationNote ?? null; break;
      case "verified": v.verified += 1; break;
      case "reconciled": v.reconciled += 1; break;
      case "pending": v.pending += 1; break;
      case "ignored": v.ignored += 1; break;
    }
  }
  return Array.from(byProvider.values()).sort((a, b) => a.providerId.localeCompare(b.providerId));
}
