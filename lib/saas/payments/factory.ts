/**
 * PaymentProviderFactory + Registry — resolve the right adapter for a charge.
 *
 * Responsibilities:
 *  - construct a live adapter for a provider (decrypting credentials server-side)
 *  - resolve the best provider for an (org country, currency, method) against
 *    routing rules, then fallback to default → any enabled provider
 *  - expose capability discovery
 *
 * Never exports decrypted secrets; adapters are used entirely server-side.
 */
import type { PaymentProviderAdapter } from "./adapter";
import type { ProviderConfig, CapabilityReport, PaymentMethod, CurrencyCode, CountryCode } from "./types";
import type { HttpTransport } from "@/lib/saas/adapters/_shared";
import { canRoutePayment } from "./types";
import { getProviderConfigs, getLiveProviderConfig } from "./store";
import { stripeAdapter } from "../adapters/stripe";
import { razorpayAdapter } from "../adapters/razorpay";
import { paypalAdapter } from "../adapters/paypal";
import { adyenAdapter } from "../adapters/adyen";
import { cashfreeAdapter } from "../adapters/cashfree";
import { payuAdapter } from "../adapters/payu";
import { genericHmacAdapter } from "../adapters/generic";
import { checkoutComAdapter } from "../adapters/checkout.com";
import { squareAdapter } from "../adapters/square";
import { mollieAdapter } from "../adapters/mollie";
import { phonePeAdapter } from "../adapters/phonepe";
import { paytmAdapter } from "../adapters/paytm";
import { easebuzzAdapter } from "../adapters/easebuzz";

/** Build a live adapter (server-side, decrypted creds). Throws if provider unknown/disabled. */
export async function buildAdapter(providerId: string): Promise<PaymentProviderAdapter> {
  const cfg = await getLiveProviderConfig(providerId);
  if (!cfg) throw new Error(`Provider "${providerId}" is not configured`);
  return instantiateAdapter(cfg);
}

type AdapterModule = {
  instance(c: ProviderConfig): PaymentProviderAdapter;
  newWithTransport(c: ProviderConfig, t: HttpTransport): PaymentProviderAdapter;
};

function build(cfg: ProviderConfig, adapter: AdapterModule, transport?: HttpTransport): PaymentProviderAdapter {
  return transport ? adapter.newWithTransport(cfg, transport) : adapter.instance(cfg);
}

export function instantiateAdapter(cfg: ProviderConfig, transport?: HttpTransport): PaymentProviderAdapter {
  switch (cfg.id) {
    case "stripe": return build(cfg, stripeAdapter, transport);
    case "razorpay": return build(cfg, razorpayAdapter, transport);
    case "paypal": return build(cfg, paypalAdapter, transport);
    case "adyen": return build(cfg, adyenAdapter, transport);
    case "cashfree": return build(cfg, cashfreeAdapter, transport);
    case "payu": return build(cfg, payuAdapter, transport);
    case "checkout.com": return build(cfg, checkoutComAdapter, transport);
    case "square": return build(cfg, squareAdapter, transport);
    case "mollie": return build(cfg, mollieAdapter, transport);
    case "phonepe": return build(cfg, phonePeAdapter, transport);
    case "paytm": return build(cfg, paytmAdapter, transport);
    case "easebuzz": return build(cfg, easebuzzAdapter, transport);
    default: return genericHmacAdapter.instance(cfg);
  }
}

export interface RoutingCriteria {
  country?: CountryCode | null;
  currency: CurrencyCode;
  method?: PaymentMethod;
}

/**
 * Resolve the adapter to charge with.
 * Order: enabled providers → explicit routing rules (by country/currency/method)
 * → the configured default → any enabled provider (by priority). Returns null
 * if nothing is enabled for the requested currency.
 */
export async function resolveProvider(
  criteria: RoutingCriteria,
): Promise<PaymentProviderAdapter | null> {
  const configs = await getProviderConfigs(true);
  const enabled = configs.filter((c) => canRoutePayment(c.integrationStatus, c.enabled));
  if (enabled.length === 0) return null;

  const supportsCur = (c: ProviderConfig) => !criteria.currency || c.currencies.length === 0 || c.currencies.includes(criteria.currency);
  const supportsMeth = (c: ProviderConfig) => !criteria.method || c.methods.length === 0 || c.methods.includes(criteria.method);
  const inCountry = (c: ProviderConfig) => !criteria.country || c.countries.length === 0 || c.countries.includes(criteria.country);

  const candidates = enabled.filter((c) => supportsCur(c) && supportsMeth(c) && inCountry(c));
  if (candidates.length === 0) return null;

  // 1) explicit routing rules (priority order stored per provider via priority)
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority);
  // 2) default wins if it's a candidate and currency-capable
  const def = sorted.find((c) => c.isDefault);
  const chosen = def && supportsCur(def) ? def : sorted[0];
  return instantiateAdapter(chosen);
}

/** Capability discovery for the UI: what the configured providers can do. */
export async function discoverCapabilities(): Promise<CapabilityReport[]> {
  const configs = await getProviderConfigs(true);
  return configs.map((c) => ({
    providerId: c.id,
    integrationStatus: c.integrationStatus,
    capabilities: c.capabilities,
    supportedCurrencies: c.currencies,
    supportedMethods: c.methods,
    testMode: c.mode === "test",
  }));
}

/** Is any enabled provider configured at all? Quick gate for checkout APIs. */
export async function anyProviderEnabled(): Promise<boolean> {
  const configs = await getProviderConfigs(true);
  return configs.some((c) => c.enabled);
}

export { catalogMeta, PROVIDER_CATALOG } from "./store";
