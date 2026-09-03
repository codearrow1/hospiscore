/**
 * Webhook reconciliation — the authoritative money-confirmation path.
 *
 * Browser success is NEVER authoritative. Only a signature-verified provider
 * webhook, passed through here, can create a canonical Payment and settle an
 * invoice. Guarantees:
 *  - exactly one canonical Payment per unique provider event (idempotency via
 *    (provider, eventId) unique + PaymentWebhookLog)
 *  - replay-safe: an already-handled event returns its prior result
 *  - amount/currency integrity: the provider-reported amount must reconcile to
 *    the intent's server-side amount; we pass it to the canonical recordPayment
 *    which re-enforces the invoice's own currency and overpayment cap
 *  - one ledger: we never insert a Payment directly — always via recordPayment
 *  - audit: every webhook outcome is logged and the Payment/Intent rows link
 */
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { buildAdapter } from "./factory";
import { getLiveProviderConfig } from "./store";
import { markIntentResult } from "./intents";
import type { PaymentWebhookEvent } from "./types";
import { GatewayError } from "@/lib/saas/adapters/_shared";

export class WebhookReconcileError extends Error {}

export interface ReconcileResult {
  handled: boolean;
  status: "reconciled" | "already_handled" | "ignored" | "failed" | "noop";
  paymentId?: string | null;
  intentId?: string | null;
  message?: string;
}

/** Verify + reconcile an incoming webhook. Server-authoritative. */
export async function reconcileWebhook(input: {
  providerId: string;
  rawBody: string;
  headers: Record<string, string | undefined | string[]>;
  ip?: string;
}): Promise<ReconcileResult> {
  const providerCfg = await getLiveProviderConfig(input.providerId);
  if (!providerCfg) {
    await writeWebhookLog(input.providerId, "unknown", "failed", null, null, "Provider not configured", input.ip, input.rawBody);
    throw new WebhookReconcileError("Provider not configured");
  }

  const adapter = await buildAdapter(input.providerId);
  let event: PaymentWebhookEvent;
  try {
    event = await adapter.verifyWebhook(input.rawBody, input.headers);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signature verification failed";
    await writeWebhookLog(input.providerId, "unknown", "failed", null, null, msg, input.ip, input.rawBody);
    throw new GatewayError(msg, 400);
  }

  const log = (await writeWebhookLog(input.providerId, event.eventId, "received", null, null, null, input.ip, event.raw)) ?? { id: "" };

  // Idempotency: already reconciled?
  const prior = await prisma.paymentWebhookLog.findUnique({
    where: { provider_eventId: { provider: input.providerId, eventId: event.eventId } },
  });
  if (prior && prior.status === "reconciled" && prior.paymentId) {
    updateWebhookLog(log.id, "reconciled", null, prior.paymentId, "replayed — already settled");
    return { handled: true, status: "already_handled", paymentId: prior.paymentId, intentId: null, message: "already reconciled" };
  }

  // Find the intent by providerRef.
  let intent = await prisma.paymentIntent.findUnique({ where: { providerRef: event.providerRef } });
  if (!intent && event.providerPaymentId) {
    // Some providers send only a payment id; try to resolve via prior payment.
    const priorPay = await prisma.payment.findUnique({ where: { providerPaymentId: event.providerPaymentId } });
    if (priorPay?.paymentIntentId) {
      intent = await prisma.paymentIntent.findUnique({ where: { id: priorPay.paymentIntentId } });
    }
  }

  if (!intent) {
    updateWebhookLog(log.id, "ignored", null, null, "No matching payment intent");
    return { handled: false, status: "ignored", message: "No matching intent" };
  }

  const intentId = intent.id;

  switch (event.type) {
    case "payment.succeeded": {
      // Server-side amount integrity — never trust a client-supplied amount; the
      // provider-reported minor amount must reconcile to the intent's amount.
      if (event.amountMinor != null && event.amountMinor !== intent.amount) {
        const msg = `Amount mismatch: provider ${event.amountMinor}, intent ${intent.amount}`;
        updateWebhookLog(log.id, "failed", intentId, null, msg);
        await markIntentResult(intentId, { status: "failed", failureReason: msg });
        throw new WebhookReconcileError(msg);
      }
      // Already settled? A succeeded event for an intent that already produced a
      // payment is a duplicate that must NOT create a second ledger row.
      const existing = intent.settledPaymentId
        ? await prisma.payment.findUnique({ where: { id: intent.settledPaymentId } })
        : null;
      if (existing) {
        updateWebhookLog(log.id, "reconciled", intentId, existing.id, "duplicate succeed — already settled");
        return { handled: true, status: "already_handled", paymentId: existing.id, intentId };
      }
      if (!intent.invoiceId) {
        const msg = "Intent has no invoice to settle";
        updateWebhookLog(log.id, "failed", intentId, null, msg);
        throw new WebhookReconcileError(msg);
      }
      // SINGLE LEDGER: delegate to the canonical payment authority. It re-reads
      // the invoice (currency match, overpayment cap) and settles it.
      const { recordPayment } = await import("@/lib/saas/gateway");
      const pay = await recordPayment({
        organizationId: intent.organizationId,
        invoiceId: intent.invoiceId,
        amount: intent.amount,
        currency: intent.currency,
        gateway: input.providerId,
        status: "succeeded",
        actorEmail: "system:webhook:" + input.providerId,
        ip: input.ip,
        idempotencyKey: `wh_${event.eventId}`,
      });
      // Link the canonical payment to the intent + provider refs (idempotent).
      await prisma.payment.update({
        where: { id: pay.id },
        data: {
          providerRef: event.providerRef || intent.providerRef,
          providerPaymentId: event.providerPaymentId ?? undefined,
          webhookEventId: event.eventId,
          paymentIntentId: intentId,
          method: event.method ?? null,
          methodMasked: event.method ? maskMethodLabel(event.method) : null,
        },
      });
      await markIntentResult(intentId, { status: "succeeded", paymentId: pay.id });
      updateWebhookLog(log.id, "reconciled", intentId, pay.id, "settled");
      await writeSaasAudit({
        byEmail: "system:webhook:" + input.providerId,
        action: "payments.reconciled",
        entity: "payment",
        entityId: pay.id,
        detail: `${input.providerId} ${event.eventId} → ${(pay.amount / 100).toFixed(2)} ${pay.currency}`,
        ip: input.ip,
      });
      return { handled: true, status: "reconciled", paymentId: pay.id, intentId };
    }
    case "payment.failed": {
      await markIntentResult(intentId, { status: "failed", failureReason: "payment failed" });
      updateWebhookLog(log.id, "reconciled", intentId, null, "failed");
      return { handled: true, status: "reconciled", intentId };
    }
    case "payment.refunded":
    case "payment.partially_refunded": {
      // Refunds are governed by the four-eyes refund control, not by an incoming
      // webhook. Log it; the actual ledger reversal flows through refundPayment
      // (which the FINANCIAL_APPROVE gate protects). A webhook cannot self-refund.
      updateWebhookLog(log.id, "ignored", intentId, null, "refund event — reversal governed by four-eyes control");
      return { handled: false, status: "noop", intentId, message: "refund routed via four-eyes control" };
    }
    default:
      updateWebhookLog(log.id, "ignored", intentId, null, "unhandled event type");
      return { handled: false, status: "noop", intentId, message: "unhandled event" };
  }
}

/** Mask a method into a display label (no sensitive data). */
function maskMethodLabel(method: string): string {
  const map: Record<string, string> = {
    card: "Card",
    upi: "UPI",
    wallet: "Wallet",
    netbanking: "Net Banking",
    bank_transfer: "Bank Transfer",
    emi: "EMI",
    paypal: "PayPal",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    crypto: "Crypto",
  };
  return map[method] ?? method;
}

async function writeWebhookLog(
  provider: string,
  eventId: string,
  status: string,
  intentId: string | null,
  paymentId: string | null,
  note: string | null,
  ip: string | undefined,
  raw?: unknown,
): Promise<{ id: string } | null> {
  try {
    return await prisma.paymentWebhookLog.upsert({
      where: { provider_eventId: { provider, eventId } },
      create: { provider, eventId, status, intentId, paymentId, verificationNote: note, ip, raw: (raw ?? {}) as never },
      update: { status, intentId, paymentId, verificationNote: note, ip },
    });
  } catch {
    return null;
  }
}

async function updateWebhookLog(
  id: string | null | undefined,
  status: string,
  intentId: string | null,
  paymentId: string | null,
  note: string | null,
): Promise<void> {
  if (!id) return;
  try {
    await prisma.paymentWebhookLog.update({ where: { id }, data: { status, intentId, paymentId, verificationNote: note } });
  } catch {
    // best effort
  }
}
