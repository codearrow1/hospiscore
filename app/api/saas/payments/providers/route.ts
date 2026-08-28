import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getProviderConfigs, saveProviderConfig, PROVIDER_CATALOG, WIRED_PROVIDER_IDS } from "@/lib/saas/payments/store";
import { listProviderHealth } from "@/lib/saas/payments/health";
import { allProviderMeta } from "@/lib/saas/payments/catalog";
import { isPaymentEncKeyConfigured } from "@/lib/saas/payments/crypto";
import { PAYMENT_METHODS, PROVIDER_CAPABILITIES } from "@/lib/saas/payments/types";
import { capabilityMatrixRows } from "@/lib/saas/payments/capabilityMatrix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/saas/payments/providers
 * Super Admin provider registry management. Only SYSTEM_SETTINGS_MANAGE
 * (super_admin / platform_admin) may view or change provider configuration.
 * GET returns MASKED credential metadata only — never a secret value.
 */
export async function GET(_req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });
  const [providers, health] = await Promise.all([getProviderConfigs(true), listProviderHealth()]);
  return NextResponse.json({
    catalog: PROVIDER_CATALOG,
    meta: allProviderMeta(),
    wiredProviders: Array.from(WIRED_PROVIDER_IDS),
    providers,
    health,
    methods: PAYMENT_METHODS,
    capabilities: PROVIDER_CAPABILITIES,
    capabilityMatrix: capabilityMatrixRows(),
    encKeyConfigured: isPaymentEncKeyConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "SYSTEM_SETTINGS_MANAGE")) return NextResponse.json({ error: "SYSTEM_SETTINGS_MANAGE required" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const secrets = (body.secrets ?? {}) as Record<string, unknown>;
  try {
    const saved = await saveProviderConfig({
      id: String(body.id),
      label: typeof body.label === "string" ? body.label : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
      priority: typeof body.priority === "number" ? body.priority : undefined,
      mode: body.mode === "live" || body.mode === "test" ? body.mode : undefined,
      countries: Array.isArray(body.countries) ? (body.countries as string[]) : undefined,
      currencies: Array.isArray(body.currencies) ? (body.currencies as string[]) : undefined,
      methods: Array.isArray(body.methods) ? (body.methods as never) : undefined,
      capabilities: Array.isArray(body.capabilities) ? (body.capabilities as never) : undefined,
      fees: body.fees as never,
      secrets: {
        publishableKey: typeof secrets.publishableKey === "string" ? secrets.publishableKey : undefined,
        secretKey: typeof secrets.secretKey === "string" ? secrets.secretKey : undefined,
        token: typeof secrets.token === "string" ? secrets.token : undefined,
        webhookSecret: typeof secrets.webhookSecret === "string" ? secrets.webhookSecret : undefined,
        extra: secrets.extra && typeof secrets.extra === "object" ? (secrets.extra as Record<string, string>) : undefined,
      },
    }, guard.user.email);
    return NextResponse.json({ provider: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 400 });
  }
}
