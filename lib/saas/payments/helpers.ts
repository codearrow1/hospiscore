/**
 * Pure helpers for the payment platform — masking, fees, capability sanity.
 * No DB, no network — fully unit-testable.
 */
import type { MaskedSecret, ProviderCapability, FeeRule, ProviderFeeConfig } from "./types";
import { PROVIDER_CAPABILITIES, PAYMENT_METHODS } from "./types";

/** Mask a secret to a safe display form (never returns the raw value). */
export function maskSecret(secret: string | null | undefined, prefixLen = 4, suffixLen = 4): string | null {
  if (!secret) return null;
  const s = String(secret).trim();
  if (s.length <= prefixLen + suffixLen + 2) return "••••";
  return `${s.slice(0, prefixLen)}••••${s.slice(-suffixLen)}`;
}

/** Build a masked storage marker from a value (drop the raw from persisted config). */
export function toMaskedSecret(raw: string | null | undefined, existing?: MaskedSecret | null): MaskedSecret {
  if (!raw || !String(raw).trim()) {
    // No new value supplied — preserve existing "set" state but keep masking.
    return existing && existing.set
      ? { set: true, masked: existing.masked, updatedAt: existing.updatedAt }
      : { set: false, masked: null, updatedAt: null };
  }
  return { set: true, masked: maskSecret(raw), updatedAt: Date.now() };
}

/** Compute a fee in minor units for an amount, honoring currency-specific caps. */
export function computeProviderFee(
  amountMinor: number,
  currency: string,
  fees: ProviderFeeConfig | undefined,
): number {
  if (!amountMinor || amountMinor <= 0) return 0;
  const rule: FeeRule | undefined =
    fees?.byCurrency?.[currency] ?? fees?.default;
  if (!rule) return 0;
  const percentFee = rule.percent ? Math.round((amountMinor * rule.percent) / 100) : 0;
  const fixed = rule.fixedMinor ?? 0;
  let total = percentFee + fixed;
  if (rule.capMinor != null && total > rule.capMinor) total = rule.capMinor;
  return Math.max(0, total);
}

/** Intersect what a provider claims with the platform's known vocabularies. */
export function normalizeCapabilities(input: unknown): ProviderCapability[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<ProviderCapability>();
  for (const c of input) {
    if (typeof c === "string" && (PROVIDER_CAPABILITIES as readonly string[]).includes(c)) {
      set.add(c as ProviderCapability);
    }
  }
  return Array.from(set);
}

export { PAYMENT_METHODS, PROVIDER_CAPABILITIES };
