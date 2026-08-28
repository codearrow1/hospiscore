/**
 * Provider credential validation — "safe connection test" for the settings UI.
 * Builds a throwaway adapter with the freshly-entered (unsaved) credentials and
 * asks it to ping the provider read-only. Returns a structured
 * CONNECTED / FAILED / UNSUPPORTED / MISCONFIGURED result and NEVER returns
 * secret values. Persisting the outcome (status transition + health) is done by
 * the caller (the API route), which owns the operator context.
 */
import { instantiateAdapter } from "./factory";
import { getProviderConfig, getLiveProviderConfig } from "./store";
import { toMaskedSecret } from "./helpers";
import type { ProviderCredentials } from "./types";
import type { ConnectionTestResult } from "./adapter";
import type { HttpTransport } from "@/lib/saas/adapters/_shared";

/**
 * Test credentials WITHOUT saving. Builds a synthetic config from the entered
 * secrets (encrypted to the same envelope so decryptCredentials reads them),
 * then calls the adapter's testConnection (read-only ping).
 */
export async function testProviderConnection(opts: {
  providerId: string;
  secrets: {
    publishableKey?: string;
    secretKey?: string;
    token?: string;
    webhookSecret?: string;
    extra?: Record<string, string>;
  };
  transport?: HttpTransport;
}): Promise<ConnectionTestResult> {
  const existing = await getProviderConfig(opts.providerId);
  if (!existing) return { status: "FAILED", error: "Unknown provider", reason: "INVALID_REQUEST" };
  const mode = existing.mode ?? "test";

  const entered: ProviderCredentials = {
    publishableKey: opts.secrets.publishableKey && opts.secrets.publishableKey.length
      ? opts.secrets.publishableKey.trim()
      : existing.credentials.publishableKey,
    secretKey: toMaskedSecret(opts.secrets.secretKey || undefined, existing.credentials.secretKey),
    token: toMaskedSecret(opts.secrets.token || undefined, existing.credentials.token),
    webhookSecret: toMaskedSecret(opts.secrets.webhookSecret || undefined, existing.credentials.webhookSecret),
    extra: {},
  };
  // Build a live config the adapter can decrypt.
  const config = await getLiveProviderConfig(opts.providerId);
  if (!config) return { status: "FAILED", error: "Provider config missing", reason: "INVALID_REQUEST" };
  config.credentials = {
    ...entered,
    // port existing extra secrets decrypted
    extra: opts.secrets.extra
      ? Object.fromEntries(Object.entries(opts.secrets.extra).map(([k, v]) => [k, toMaskedSecret(v)]))
      : (config.credentials.extra as never),
  };
  config.mode = mode;

  const adapter = instantiateAdapter(config);
  try {
    const res = await adapter.testConnection(config.credentials);
    return { status: res.status, error: res.error, reason: res.reason };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: "UNKNOWN" };
  }
}
