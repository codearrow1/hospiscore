/**
 * HospiOS centralized formatting primitives (Phase 1).
 *
 * Every user-facing money/date/number string must come from here so currency,
 * locale and timezone handling stay consistent across all product surfaces.
 */

const MISSING = "—";

function resolveCurrency(currency?: string | null): string | null {
  if (!currency) return null;
  const code = String(currency).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/**
 * Format a minor-unit amount with its record currency.
 * Returns an em dash for unknown amounts/currencies instead of guessing USD.
 */
export function formatMoney(
  minor: number | null | undefined,
  currency?: string | null,
  opts: { locale?: string; signed?: boolean } = {},
): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return MISSING;
  const code = resolveCurrency(currency);
  if (!code) return MISSING;
  try {
    const fmt = new Intl.NumberFormat(opts.locale ?? "en-US", {
      style: "currency",
      currency: code,
    });
    const value = minor / 100;
    if (opts.signed && value > 0) return `+${fmt.format(value)}`;
    return fmt.format(value);
  } catch {
    return MISSING;
  }
}

/** Basis points → human percent ("1500" → "15%"). */
export function formatBps(bps: number | null | undefined, digits = 0): string {
  if (bps === null || bps === undefined || Number.isNaN(bps)) return MISSING;
  return `${(bps / 100).toFixed(digits)}%`;
}

/** Fraction or already-percent number → percent string. `formatPct(0.42)` → "42%", `formatPct(42, {asFraction:false})` → "42%". */
export function formatPct(
  value: number | null | undefined,
  opts: { asFraction?: boolean; digits?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  const pct = opts.asFraction === false ? value : value * 100;
  return `${pct.toFixed(opts.digits ?? 0)}%`;
}

export function formatNumber(
  value: number | null | undefined,
  opts: { locale?: string; maximumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  return new Intl.NumberFormat(opts.locale ?? "en-US", {
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
  }).format(value);
}

function toDate(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Locale date, e.g. "Aug 24, 2026". Timezone-aware via opts.timeZone. */
export function formatDate(
  input: Date | string | number | null | undefined,
  opts: { locale?: string; timeZone?: string } = {},
): string {
  const d = toDate(input);
  if (!d) return MISSING;
  try {
    return new Intl.DateTimeFormat(opts.locale ?? "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: opts.timeZone,
    }).format(d);
  } catch {
    return MISSING;
  }
}

/** Locale date+time, e.g. "Aug 24, 2026, 3:05 PM". */
export function formatDateTime(
  input: Date | string | number | null | undefined,
  opts: { locale?: string; timeZone?: string } = {},
): string {
  const d = toDate(input);
  if (!d) return MISSING;
  try {
    return new Intl.DateTimeFormat(opts.locale ?? "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: opts.timeZone,
    }).format(d);
  } catch {
    return MISSING;
  }
}

/** Coarse relative time for timelines ("in 3 days", "2 hours ago"). */
export function formatRelative(
  input: Date | string | number | null | undefined,
  now: Date = new Date(),
): string {
  const d = toDate(input);
  if (!d) return MISSING;
  const diffMs = d.getTime() - now.getTime();
  const sign = diffMs < 0 ? -1 : 1;
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absMin < 1) return "just now";
  if (absMin < 60) return rtf.format(sign * absMin, "minute");
  const absH = Math.round(absMin / 60);
  if (absH < 24) return rtf.format(sign * absH, "hour");
  const absD = Math.round(absH / 24);
  if (absD < 30) return rtf.format(sign * absD, "day");
  const absMo = Math.round(absD / 30);
  if (absMo < 12) return rtf.format(sign * absMo, "month");
  return rtf.format(sign * Math.round(absMo / 12), "year");
}
