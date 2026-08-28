/**
 * Payment error taxonomy (Phase K).
 *
 * Provider adapters may throw raw gateway errors. Before that bubbles to a
 * customer or an operator, it is classified into a stable, normalized reason
 * code so the UI can present a friendly message and operators can filter
 * alerts — without ever leaking provider-internal secrets or raw responses.
 */
import { GatewayError } from "@/lib/saas/adapters/_shared";

export type PaymentErrorCode =
  | "CARD_DECLINED"
  | "INSUFFICIENT_FUNDS"
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "WEBHOOK_INVALID"
  | "TIMEOUT"
  | "CANCELLED"
  | "UNKNOWN";

export const PAYMENT_ERROR_CODES: readonly PaymentErrorCode[] = [
  "CARD_DECLINED",
  "INSUFFICIENT_FUNDS",
  "AUTHENTICATION_FAILED",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "INVALID_REQUEST",
  "WEBHOOK_INVALID",
  "TIMEOUT",
  "CANCELLED",
  "UNKNOWN",
];

/** Friendly, provider-agnostic message shown to a customer. */
export const FRIENDLY_ERROR_MESSAGE: Record<PaymentErrorCode, string> = {
  CARD_DECLINED: "Your card was declined. Please try a different card.",
  INSUFFICIENT_FUNDS: "Your card has insufficient funds. Try another payment method.",
  AUTHENTICATION_FAILED: "We couldn't verify this payment (authentication failed). Please try again.",
  RATE_LIMITED: "Too many attempts were made. Please wait a moment and try again.",
  PROVIDER_UNAVAILABLE: "The payment provider is temporarily unavailable. Please try again shortly.",
  INVALID_REQUEST: "This payment could not be processed. Please contact support.",
  WEBHOOK_INVALID: "We couldn't verify this payment confirmation. Please contact support.",
  TIMEOUT: "The payment provider took too long to respond. Please try again.",
  CANCELLED: "The payment was cancelled.",
  UNKNOWN: "Something went wrong with the payment. Please try again.",
};

interface ClassifierInput {
  status?: number;
  message?: string;
  raw?: string;
  code?: string;
}

/**
 * Classify an arbitrary thrown provider error into a normalized reason code.
 * Prefers an explicit classifier `code`; otherwise heuristically maps HTTP
 * status + message keywords. This runs on a controlled `message` string only —
 * never on raw provider responses that could contain secrets.
 */
export function classifyPaymentError(err: unknown, hint?: ClassifierInput): PaymentErrorCode {
  const msg = String(
    (err instanceof Error ? err.message : "") || hint?.message || "",
  ).toLowerCase();
  const code = (hint?.code ?? "").toLowerCase();
  const status = hint?.status ?? (err instanceof GatewayError ? err.status : undefined);

  if (code) {
    if (code.includes("card_declined") || code.includes("declined")) return "CARD_DECLINED";
    if (code.includes("insufficient_funds")) return "INSUFFICIENT_FUNDS";
    if (code.includes("authentication")) return "AUTHENTICATION_FAILED";
    if (code.includes("rate_limit")) return "RATE_LIMITED";
    if (code.includes("timeout")) return "TIMEOUT";
    if (code.includes("cancel")) return "CANCELLED";
    if (code.includes("invalid") || code.includes("processing_error")) return "INVALID_REQUEST";
    if (code.includes("unavailable") || code.includes("connection")) return "PROVIDER_UNAVAILABLE";
  }

  if (msg.includes("declin") || msg.includes("card was declined")) return "CARD_DECLINED";
  if (msg.includes("insufficient")) return "INSUFFICIENT_FUNDS";
  if (msg.includes("authentication") || msg.includes("3d secure") || msg.includes("verify")) return "AUTHENTICATION_FAILED";
  if (msg.includes("rate limit")) return "RATE_LIMITED";
  if (msg.includes("timed out") || msg.includes("timeout") || msg.includes("abort")) return "TIMEOUT";
  if (msg.includes("cancelled") || msg.includes("canceled")) return "CANCELLED";
  if (msg.includes("unavailable") || msg.includes("temporarily") || msg.includes("connection error")) return "PROVIDER_UNAVAILABLE";

  if (status !== undefined) {
    if (status === 429) return "RATE_LIMITED";
    if (status >= 500) return "PROVIDER_UNAVAILABLE";
    if (status === 401 || status === 403) return "AUTHENTICATION_FAILED";
    if (status === 400 || status === 422) return "INVALID_REQUEST";
  }

  return "UNKNOWN";
}

/** Build a friendly customer message for an arbitrary thrown error. */
export function friendlyMessageFor(err: unknown): string {
  const code = classifyPaymentError(err);
  return FRIENDLY_ERROR_MESSAGE[code];
}

/**
 * Render a safe, sanitized representation of an arbitrary thrown error for
 * operator surfaces (never echoes raw provider secrets).
 */
export function sanitizePaymentError(err: unknown): { reason: PaymentErrorCode; message: string; status?: number } {
  const reason = classifyPaymentError(err);
  const message = err instanceof Error ? err.message : "Unexpected payment error";
  const status = err instanceof GatewayError ? err.status : undefined;
  return { reason, message, status };
}
