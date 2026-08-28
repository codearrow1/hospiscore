import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getProviderConfig, deleteProviderConfig, setProviderStatus } from "@/lib/saas/payments/store";
import { testProviderConnection } from "@/lib/saas/payments/validate";
import { recordProviderOutcome, listProviderHealth, listWebhookHealth } from "@/lib/saas/payments/health";
import { providerMeta } from "@/lib/saas/payments/catalog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/payments/providers/[id]
 * Super Admin management of a single provider: GET returns full observability
 * (config + meta + connection health + webhook health + recent webhook log +
 * recent payments), DELETE removes it, POST test-connection validates then
 * persists the resulting activation status and connection health. Secrets are
 * never returned.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const { id } = await ctx.params;
  const providerId = String(id).toLowerCase();
  const provider = await getProviderConfig(providerId);
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  const [meta, healthRow, wh, webhookLog, payments] = await Promise.all([
    providerMeta(providerId) ?? null,
    listProviderHealth().then((hs) => hs.find((h) => h.providerId === providerId) ?? null),
    listWebhookHealth(providerId),
    prisma.paymentWebhookLog.findMany({ where: { provider: providerId }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.payment.findMany({ where: { gateway: providerId }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return NextResponse.json({ provider, meta, health: healthRow, webhookHealth: wh, recentWebhooks: webhookLog, recentPayments: payments });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const { id } = await ctx.params;
  const ok = await deleteProviderConfig(String(id).toLowerCase(), guard.user.email);
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404 });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const { id } = await ctx.params;
  const providerId = String(id).toLowerCase();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "test-connection") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const secrets = (body.secrets ?? {}) as Record<string, unknown>;
  const result = await testProviderConnection({
    providerId,
    secrets: {
      publishableKey: typeof secrets.publishableKey === "string" ? secrets.publishableKey : undefined,
      secretKey: typeof secrets.secretKey === "string" ? secrets.secretKey : undefined,
      token: typeof secrets.token === "string" ? secrets.token : undefined,
      webhookSecret: typeof secrets.webhookSecret === "string" ? secrets.webhookSecret : undefined,
      extra: secrets.extra && typeof secrets.extra === "object" ? (secrets.extra as Record<string, string>) : undefined,
    },
  });

  // Persist activation status + connection health from the real test outcome.
  // ONLY a genuine CONNECTED result marks the provider READY; nothing else does.
  if (result.status === "CONNECTED") {
    await setProviderStatus(providerId, "ready", guard.user.email).catch(() => null);
    await recordProviderOutcome({ providerId, ok: true, actorEmail: guard.user.email }).catch(() => null);
  } else if (result.status === "FAILED") {
    await setProviderStatus(providerId, "verification_failed", guard.user.email).catch(() => null);
    await recordProviderOutcome({ providerId, ok: false, error: result.error ?? null, actorEmail: guard.user.email }).catch(() => null);
  } else if (result.status === "MISCONFIGURED") {
    await setProviderStatus(providerId, "misconfigured", guard.user.email).catch(() => null);
  }
  // UNSUPPORTED → no confidence to promote; provider stays insufficiently
  // verified (never routes) and is never marked ready.

  return NextResponse.json({ result });
}

