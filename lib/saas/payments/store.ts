/**
 * Provider config store — the single source of truth for the provider registry.
 *
 * Persists in SystemSetting("payment_providers") as a JSON map keyed by provider
 * id (mirrors the financial_controls pattern). Secrets are stored ENCRYPTED and
 * are NEVER returned raw: every read path returns masked forms. All mutations
 * are audited via writeSaasAudit.
 */
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { encryptSecret, decryptSecret } from "./crypto";
import { maskSecret, normalizeCapabilities } from "./helpers";
import { defaultMatrixFor } from "./capabilityMatrix";
import type { ProviderConfig, MaskedSecret, ProviderCredentials, ProviderCapability, PaymentMethod, CurrencyCode, CountryCode, ProviderIntegrationStatus } from "./types";

const KEY = "payment_providers";

/** Providers that have a real adapter wired (per official docs). Saving one of
 *  these upgrades its integration status to "verify" so checkout can proceed;
 *  everything else stays "registered" (never fakes a capability). */
export const WIRED_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "stripe",
  "razorpay",
  "paypal",
  "adyen",
  "cashfree",
  "payu",
  "checkout.com",
  "square",
  "mollie",
  "phonepe",
  "paytm",
  "easebuzz",
  "generic",
]);

export const PROVIDER_CATALOG: { id: string; label: string; family: "fiat" | "crypto" }[] = [
  // Global
  { id: "stripe", label: "Stripe", family: "fiat" },
  { id: "paypal", label: "PayPal", family: "fiat" },
  { id: "adyen", label: "Adyen", family: "fiat" },
  { id: "checkout.com", label: "Checkout.com", family: "fiat" },
  { id: "braintree", label: "Braintree", family: "fiat" },
  { id: "authorize.net", label: "Authorize.net", family: "fiat" },
  { id: "square", label: "Square", family: "fiat" },
  { id: "worldpay", label: "Worldpay", family: "fiat" },
  { id: "mollie", label: "Mollie", family: "fiat" },
  // India
  { id: "razorpay", label: "Razorpay", family: "fiat" },
  { id: "cashfree", label: "Cashfree", family: "fiat" },
  { id: "payu", label: "PayU", family: "fiat" },
  { id: "ccavenue", label: "CCAvenue", family: "fiat" },
  { id: "easebuzz", label: "Easebuzz", family: "fiat" },
  { id: "phonepe", label: "PhonePe Payment Gateway", family: "fiat" },
  { id: "paytm", label: "Paytm Payments", family: "fiat" },
  // Crypto (fiat settlement kept distinct)
  { id: "coinbase", label: "Coinbase Commerce", family: "crypto" },
];

export function catalogMeta(id: string) {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}

/** Default (pristine) config for a provider before any user changes. */
export function defaultProviderConfig(id: string): ProviderConfig {
  const meta = catalogMeta(id) ?? { id, label: id, family: "fiat" as const };
  const matrix = defaultMatrixFor(id);
  return {
    id: meta.id,
    label: meta.label,
    integrationStatus: "registered",
    family: meta.family,
    enabled: false,
    isDefault: false,
    priority: 100,
    mode: "test",
    countries: matrix.countries,
    currencies: matrix.currencies,
    methods: matrix.methods,
    capabilities: matrix.capabilities,
    fees: { default: undefined, byCurrency: {} },
    credentials: {},
    webhookPath: `/api/payments/webhook/${meta.id}`,
    health: { healthy: false, lastCheckedAt: null, lastError: null, successRate: null, consecutiveFailures: 0 },
  };
}

/** Mask a stored (encrypted) credential bundle for safe serialization. */
function maskCredentialBundle(creds: ProviderCredentials): ProviderCredentials {
  const mask = (m?: MaskedSecret) => (m ? { set: m.set, masked: m.masked, updatedAt: m.updatedAt } : undefined);
  const extra: Record<string, MaskedSecret> = {};
  for (const [k, v] of Object.entries(creds.extra ?? {})) extra[k] = mask(v) as MaskedSecret;
  return {
    publishableKey: creds.publishableKey ? maskSecret(creds.publishableKey) ?? undefined : undefined,
    secretKey: mask(creds.secretKey),
    token: mask(creds.token),
    webhookSecret: mask(creds.webhookSecret),
    extra,
  };
}

/**
 * Decrypt live credential values for server-side adapter use (never serialized).
 * Returns a ProviderCredentials-shaped bundle where each `.masked` carries the
 * PLAINTEXT secret so adapters can read `secretKey.masked` as the live value.
 */
export function decryptCredentials(creds: ProviderCredentials): ProviderCredentials {
  const dec = (m?: MaskedSecret): MaskedSecret | undefined => {
    if (!m || !m.set) return undefined;
    const plain = decryptSecret(m.masked ?? "");
    if (!plain) return undefined;
    return { masked: plain, set: true, updatedAt: Date.now() };
  };
  const extra: Record<string, MaskedSecret> = {};
  for (const [k, v] of Object.entries(creds.extra ?? {})) {
    if (!v || !v.set) continue;
    const plain = decryptSecret(v.masked ?? "");
    if (plain) extra[k] = { masked: plain, set: true, updatedAt: Date.now() };
  }
  return {
    publishableKey: creds.publishableKey,
    secretKey: dec(creds.secretKey),
    token: dec(creds.token),
    webhookSecret: dec(creds.webhookSecret),
    extra,
  };
}

export async function getRawProviderConfigs(): Promise<Record<string, ProviderConfig>> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  if (!row?.value) return {};
  const value = row.value as unknown as Record<string, ProviderConfig>;
  const out: Record<string, ProviderConfig> = {};
  for (const [id, cfg] of Object.entries(value)) {
    if (!id || !cfg || typeof cfg !== "object") continue;
    // Always normalize + fill defaults so old/partial rows are valid.
    const d = defaultProviderConfig(id);
    out[id] = {
      ...d,
      ...cfg,
      label: cfg.label || d.label,
      fees: cfg.fees ?? d.fees,
      health: { ...d.health, ...(cfg.health ?? {}) },
      credentials: cfg.credentials ?? {},
    };
  }
  return out;
}

/** Client-safe view: secrets fully masked / publishable keys masked. */
export async function getProviderConfigs(includeDisabled = true): Promise<ProviderConfig[]> {
  const raw = await getRawProviderConfigs();
  let list = Object.values(raw);
  if (!includeDisabled) list = list.filter((c) => c.enabled);
  return list.map((c) => ({ ...c, credentials: maskCredentialBundle(c.credentials) }));
}

export async function getProviderConfig(id: string): Promise<ProviderConfig | null> {
  const all = await getProviderConfigs(true);
  return all.find((c) => c.id === id) ?? null;
}

/** Full (decrypted) config for server-side adapter use — NEVER exposed to clients. */
export async function getLiveProviderConfig(id: string): Promise<ProviderConfig | null> {
  const raw = await getRawProviderConfigs();
  const cfg = raw[id];
  if (!cfg) return null;
  return { ...cfg, credentials: decryptCredentials(cfg.credentials) };
}

export interface SaveProviderInput {
  id: string;
  label?: string;
  enabled?: boolean;
  isDefault?: boolean;
  priority?: number;
  mode?: "test" | "live";
  /** Explicit acknowledgment required to flip a provider from test → live (O-16). */
  confirmLiveActivation?: boolean;
  countries?: CountryCode[];
  currencies?: CurrencyCode[];
  methods?: PaymentMethod[];
  capabilities?: ProviderCapability[];
  fees?: ProviderConfig["fees"];
  /** Raw secret values — only when the operator is (re)entering them. */
  secrets?: {
    publishableKey?: string;
    secretKey?: string;
    token?: string;
    webhookSecret?: string;
    extra?: Record<string, string>;
  };
}

/** Validate + persist one provider. Never stores plaintext secrets; always audited. */
export async function saveProviderConfig(input: SaveProviderInput, actorEmail: string): Promise<ProviderConfig> {
  const meta = catalogMeta(input.id);
  if (!meta) throw new Error(`Unknown provider "${input.id}"`);
  const current = await getRawProviderConfigs();
  const prev = current[input.id];

  // O-16: explicit TEST → LIVE activation gate. A provider whose credentials
  // were verified in test mode must NOT silently start routing live funds just
  // because `mode` is flipped. Require an explicit acknowledgment flag.
  if (input.mode === "live" && prev?.mode !== "live" && !input.confirmLiveActivation) {
    throw new Error(
      `Provider "${input.id}" cannot switch to live mode without explicit activation. Set confirmLiveActivation to acknowledge this moves real-money routing online (O-16).`,
    );
  }

  // Resolve the incoming secret updates into encrypted MaskedSecret slots,
  // preserving existing values when no new raw value was supplied.
  const mkSecret = (raw: string | undefined, existing?: MaskedSecret): MaskedSecret => {
    if (raw === undefined || raw === null) {
      return existing ?? { set: false, masked: null, updatedAt: null };
    }
    if (!String(raw).trim()) {
      // empty string = clear the secret
      return { set: false, masked: null, updatedAt: Date.now() };
    }
    const enc = encryptSecret(String(raw).trim());
    return { set: true, masked: enc, updatedAt: Date.now() };
  };

  const prevCreds = prev?.credentials ?? {};
  const credentials: ProviderCredentials = {
    publishableKey: input.secrets?.publishableKey !== undefined && input.secrets.publishableKey.length > 0
      ? input.secrets.publishableKey.trim()
      : prevCreds.publishableKey,
    secretKey: mkSecret(input.secrets?.secretKey, prevCreds.secretKey),
    token: mkSecret(input.secrets?.token, prevCreds.token),
    webhookSecret: mkSecret(input.secrets?.webhookSecret, prevCreds.webhookSecret),
    extra: mergeExtraSecrets(prevCreds.extra ?? {}, input.secrets?.extra ?? {}),
  };

  const anyRealSecret =
    Boolean(input.secrets && Object.entries(input.secrets).some(([, v]) =>
      v !== undefined && String(v ?? "").trim() !== ""));
  const nextEnabled = input.enabled !== undefined ? input.enabled : (prev?.enabled ?? false);
  const hadReady = prev?.integrationStatus === "ready";
  let integrationStatus: ProviderIntegrationStatus;
  if (!WIRED_PROVIDER_IDS.has(input.id)) {
    integrationStatus = "registered";
  } else if (!nextEnabled) {
    integrationStatus = "disabled";
  } else if (hadReady && !anyRealSecret) {
    integrationStatus = "ready"; // unchanged verified credentials
  } else {
    integrationStatus = "verifying"; // credentials (re)entered — must pass a connection test
  }

  const next: ProviderConfig = {
    ...(prev ?? defaultProviderConfig(input.id)),
    id: input.id,
    label: (input.label ?? prev?.label ?? meta.label).trim() || meta.label,
    family: meta.family,
    integrationStatus,
    enabled: nextEnabled,
    isDefault: input.isDefault !== undefined ? input.isDefault : (prev?.isDefault ?? false),
    priority: input.priority !== undefined ? Math.max(1, Math.round(Number(input.priority) || 1)) : (prev?.priority ?? 100),
    mode: input.mode !== undefined ? input.mode : (prev?.mode ?? "test"),
    countries: input.countries ?? prev?.countries ?? [],
    currencies: input.currencies ?? prev?.currencies ?? [],
    methods: input.methods ?? prev?.methods ?? [],
    capabilities: input.capabilities ? normalizeCapabilities(input.capabilities) : (prev?.capabilities ?? []),
    fees: input.fees ?? prev?.fees ?? { default: undefined, byCurrency: {} },
    credentials,
    webhookPath: prev?.webhookPath ?? `/api/payments/webhook/${input.id}`,
    health: prev?.health ?? defaultProviderConfig(input.id).health,
  };

  const all = { ...current, [input.id]: next };
  // On save, allow only one default.
  if (next.isDefault) {
    for (const [id, c] of Object.entries(all)) {
      if (id !== input.id && c.isDefault) all[id] = { ...c, isDefault: false };
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: all as never, updatedByEmail: actorEmail, updatedAt: new Date() },
    update: { value: all as never, updatedByEmail: actorEmail, updatedAt: new Date() },
  });

  await writeSaasAudit({
    byEmail: actorEmail,
    action: "payments.provider_updated",
    entity: "payment_provider",
    entityId: input.id,
    detail: `${input.id} enabled=${next.enabled} mode=${next.mode} priority=${next.priority} default=${next.isDefault}`,
    before: prev ? { enabled: prev.enabled, mode: prev.mode, priority: prev.priority } : {},
    after: { enabled: next.enabled, mode: next.mode, priority: next.priority, credentialsChanged: Boolean(input.secrets) },
  });
  return maskProviderForReturn(next);
}

/**
 * Persist a provider activation-status transition (Phase K). Used by the
 * connection-test path to move a provider to `ready` / `verification_failed`
 * and by operators to suspend (`disabled`) a provider. Audited.
 */
export async function setProviderStatus(
  id: string,
  status: ProviderIntegrationStatus,
  actorEmail: string,
): Promise<ProviderConfig | null> {
  const all = await getRawProviderConfigs();
  const prev = all[id];
  if (!prev) return null;
  // Unwired providers can never become READY (no real adapter to verify).
  if (status === "ready" && !WIRED_PROVIDER_IDS.has(id)) return maskProviderForReturn(prev);
  if (prev.integrationStatus === status) return maskProviderForReturn(prev);
  const next: ProviderConfig = { ...prev, integrationStatus: status };
  all[id] = next;
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: all as never, updatedByEmail: actorEmail, updatedAt: new Date() },
    update: { value: all as never, updatedByEmail: actorEmail, updatedAt: new Date() },
  });
  await writeSaasAudit({
    byEmail: actorEmail,
    action: "payments.provider_activated",
    entity: "payment_provider",
    entityId: id,
    detail: `integrationStatus ${prev.integrationStatus} → ${status}`,
    before: { integrationStatus: prev.integrationStatus },
    after: { integrationStatus: status },
  });
  return maskProviderForReturn(next);
}

function mergeExtraSecrets(existing: Record<string, MaskedSecret>, incoming: Record<string, string>): Record<string, MaskedSecret> {
  const out: Record<string, MaskedSecret> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (!k) continue;
    if (v === undefined) continue;
    if (!String(v).trim()) {
      delete out[k];
      continue;
    }
    out[k] = { set: true, masked: encryptSecret(String(v).trim()), updatedAt: Date.now() };
  }
  return out;
}

/** Masked serialization for API responses. */
function maskProviderForReturn(cfg: ProviderConfig): ProviderConfig {
  return { ...cfg, credentials: maskCredentialBundle(cfg.credentials) };
}

export async function deleteProviderConfig(id: string, actorEmail: string): Promise<boolean> {
  const all = await getRawProviderConfigs();
  if (!all[id]) return false;
  delete all[id];
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: all as never, updatedByEmail: actorEmail, updatedAt: new Date() },
    update: { value: all as never, updatedByEmail: actorEmail, updatedAt: new Date() },
  });
  await writeSaasAudit({ byEmail: actorEmail, action: "payments.provider_deleted", entity: "payment_provider", entityId: id });
  return true;
}
