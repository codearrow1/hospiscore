/**
 * Currency registry. Independent local-currency formatting metadata.
 * Prices are stored in the local currency unit per country — the engine never
 * converts between currencies at runtime.
 */
import type { CurrencyMeta } from "./types";

export const CURRENCIES: Record<string, CurrencyMeta> = {
  USD: { code: "USD", symbol: "$", symbolGap: false, locale: "en-US", decimals: 0 },
  INR: { code: "INR", symbol: "₹", symbolGap: false, locale: "en-IN", decimals: 0 },
  GBP: { code: "GBP", symbol: "£", symbolGap: false, locale: "en-GB", decimals: 0 },
  CAD: { code: "CAD", symbol: "C$", symbolGap: false, locale: "en-CA", decimals: 0 },
  AUD: { code: "AUD", symbol: "A$", symbolGap: false, locale: "en-AU", decimals: 0 },
  EUR: { code: "EUR", symbol: "€", symbolGap: false, locale: "en-IE", decimals: 0 },
  AED: { code: "AED", symbol: "AED", symbolGap: true, locale: "en-US", decimals: 0 },
  SGD: { code: "SGD", symbol: "S$", symbolGap: false, locale: "en-SG", decimals: 0 },
  NPR: { code: "NPR", symbol: "रू", symbolGap: false, locale: "en-IN", decimals: 0 },
  BDT: { code: "BDT", symbol: "৳", symbolGap: false, locale: "en-IN", decimals: 0 },
  PKR: { code: "PKR", symbol: "₨", symbolGap: false, locale: "en-PK", decimals: 0 },
  LKR: { code: "LKR", symbol: "රු", symbolGap: false, locale: "en-LK", decimals: 0 },
  NGN: { code: "NGN", symbol: "₦", symbolGap: false, locale: "en-NG", decimals: 0 },
  KES: { code: "KES", symbol: "KSh", symbolGap: true, locale: "en-KE", decimals: 0 },
  ZAR: { code: "ZAR", symbol: "R", symbolGap: true, locale: "en-ZA", decimals: 0 },
  JPY: { code: "JPY", symbol: "¥", symbolGap: false, locale: "ja-JP", decimals: 0 },
  CHF: { code: "CHF", symbol: "CHF", symbolGap: true, locale: "de-CH", decimals: 2 },
  SEK: { code: "SEK", symbol: "kr", symbolGap: false, locale: "sv-SE", decimals: 0 },
  NOK: { code: "NOK", symbol: "kr", symbolGap: false, locale: "nb-NO", decimals: 0 },
  DKK: { code: "DKK", symbol: "kr", symbolGap: false, locale: "da-DK", decimals: 0 },
  BRL: { code: "BRL", symbol: "R$", symbolGap: false, locale: "pt-BR", decimals: 2 },
  MXN: { code: "MXN", symbol: "MX$", symbolGap: false, locale: "es-MX", decimals: 0 },
} as const;

export const DEFAULT_CURRENCY = "USD";

export function getCurrency(code: string): CurrencyMeta {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}