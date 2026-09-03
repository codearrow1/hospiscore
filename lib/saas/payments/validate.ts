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
import type { MaskedSecret } from "./types";
import type { ConnectionTestResult } from "./adapter";
import type { HttpTransport } from "@/lib/saas/adapters/_shared";

/**
 * Test credentials WITHOUT saving. Builds a live config from the entered (or
 * previously saved) secrets and calls the adapter's testConnection (read-only
 * ping).
 *
 * The adapter contract is that `getLiveProviderConfig` returns a bundle whose
 * `.masked` fields carry the DECRYPTED PLAINTEXT secret, so adapters can read
 * `secretKey.masked` as the live value (see store.decryptCredentials). Any
 * freshly-entered secret must therefore be placed into the bundle as plaintext
 * too — NOT display-masked (a masked `sk_live_••••1234` would be sent to the
 * provider and every connection test would fail with 401).
 *
 * The bundle is held transiently in server memory and only passed to the
 * adapter; it is never serialized to the client (store returns masked views).
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

  // Build a live config from the decrypted existing values; substitute any
  // freshly-entered raw secret verbatim so the adapter receives plaintext.
  const config = await getLiveProviderConfig(opts.providerId);
  if (!config) return { status: "FAILED", error: "Provider config missing", reason: "INVALID_REQUEST" };

  const plain = (raw: string | undefined, existingVal?: MaskedSecret): MaskedSecret | undefined => {
    if (raw !== undefined && raw !== null && String(raw).trim()) {
      return { set: true, masked: String(raw).trim(), updatedAt: Date.now() };
    }
    return existingVal;
  };

  config.credentials = {
    publishableKey:
      opts.secrets.publishableKey && opts.secrets.publishableKey.trim().length
        ? opts.secrets.publishableKey.trim()
        : config.credentials.publishableKey,
    secretKey: plain(opts.secrets.secretKey, config.credentials.secretKey),
    token: plain(opts.secrets.token, config.credentials.token),
    webhookSecret: plain(opts.secrets.webhookSecret, config.credentials.webhookSecret),
    extra: opts.secrets.extra
      ? Object.fromEntries(
          Object.entries(opts.secrets.extra).map(([k, v]) => [
            k,
            { set: true, masked: String(v).trim(), updatedAt: Date.now() },
          ]),
        )
      : config.credentials.extra,
  };
  config.mode = mode;

  const adapter = instantiateAdapter(config, opts.transport);
  try {
    const res = await adapter.testConnection(config.credentials);
    return { status: res.status, error: res.error, reason: res.reason };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : "Connection failed", reason: "UNKNOWN" };
  }
}
