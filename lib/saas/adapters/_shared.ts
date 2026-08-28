/**
 * Shared helpers for provider adapters: injectable HTTP transport, common
 * signature primitives, and normalized error types. Keeps every adapter able
 * to run with a fake transport in tests (no real network required).
 */
import { createHmac, createHash } from "node:crypto";
import { safeEqual } from "@/lib/saas/payments/crypto";

export type HttpInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type HttpTransport = (url: string, init?: HttpInit) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

/** Default transport — global fetch, thrown errors normalized. */
export const defaultHttp: HttpTransport = async (url, init) => {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
  });
  return {
    ok: res.ok,
    status: res.status,
    text: () => res.text(),
    json: () => res.json(),
  };
};

/** New AdapterTransportError — surfaced as a clean, safe error message. */
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly raw?: string,
    readonly reason?: string,
    readonly customerMessage?: string,
  ) {
    super(message);
  }
}

/** HMAC-SHA256 (hex) — used by Razorpay, Cashfree, Adyen (HMAC-key auth), PayU. */
export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** HMAC-SHA1 (hex) — used by PayU for its settle-status callback signature. */
export function hmacSha1Hex(secret: string, payload: string): string {
  return createHmac("sha1", secret).update(payload).digest("hex");
}

/** SHA-256 hex of a UTF-8 payload. */
export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

/** Constant-time compare of two signature values. */
export function matchSignature(expected: string, provided: string): boolean {
  return safeEqual(String(expected).toLowerCase(), String(provided).toLowerCase());
}

/** Parse a comma-separated header list into a map (case-insensitive keys). */
export function headerMap(headers: Record<string, string | undefined | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (v === undefined || v === null) continue;
    const val = Array.isArray(v) ? v.join(",") : v;
    out[k.toLowerCase()] = val;
  }
  return out;
}

/**
 * Safe readers — provider responses are untrusted. Every reader narrows `unknown`
 * into a well-typed primitive WITHOUT spreading `as` casts through an adapter.
 * A value that is not the expected shape falls back to a safe default rather
 * than throwing. These are the ONLY sanctioned way to touch gateway payloads.
 */
export type UnknownRecord = Record<string, unknown>;

/** Narrow `unknown` → a plain object (arrays and null become {}). Never throws. */
export function readRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

/** Narrow `unknown` → an array of `unknown` elements. Never throws. */
export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Narrow `unknown` → string (non-strings fall back). Never throws. */
export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Narrow `unknown` → number or null (accepts finite numbers & numeric strings). */
export function readNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Narrow `unknown` → boolean (accepts true/"true"/1/"1"). */
export function readBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * Read a nested string off a record path (e.g. readNestedString(obj, "data", "id")).
 * Mirrors the "safe narrowing at every hop" rule without chained casts.
 */
export function readNestedString(root: unknown, ...keys: string[]): string {
  let cur: unknown = root;
  for (const k of keys) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return "";
    cur = (cur as UnknownRecord)[k];
  }
  return readString(cur);
}

/** Cast an unknown to a record for safe nested access (never throws). Legacy alias. */
export function rec(v: unknown): Record<string, unknown> {
  return readRecord(v);
}

/** Array cast that tolerates unknown element shapes. Legacy alias. */
export function recArr(v: unknown): Record<string, unknown>[] {
  return readArray(v) as Record<string, unknown>[];
}
