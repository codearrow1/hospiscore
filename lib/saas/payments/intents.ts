/**
 * Payment intent lifecycle — server-authoritative checkout creation.
 *
 * The server computes the amount from the invoice (never trusts the browser),
 * verifies tenant ownership, resolves a provider, and persists a PaymentIntent
 * BEFORE any provider checkout is created. The canonical money ledger (Payment)
 * is only written later by reconcile.ts on a verified webhook.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { writeSaasAudit } from "@/lib/saas/audit";
import { resolveProvider, anyProviderEnabled } from "./factory";
import { canRoutePayment } from "./types";
import type { PaymentCheckout } from "./types";

export class PaymentIntentError extends Error {}

export interface CreateIntentInput {
  organizationId: string;
  invoiceId: string;
  /** Desired method (routing hint); undefined = let router decide. */
  method?: string;
  returnUrl?: string;
  cancelUrl?: string;
  actorEmail: string;
  ip?: string;
}

export interface IntentResult {
  intentId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  clientToken: string | null;
  providerRef: string;
  expiresAtMs: number | null;
}

/**
 * Create a payment intent for an invoice. The invoice must be outstanding for
 * this org (server-side ownership + balance checks). Amount is the current
 * outstanding balance — never the browser's. Returns the hosted checkout.
 *
 * Existing unsettled intent check: an open intent for the same invoice is
 * reused (idempotent), preventing duplicate checkout pages for one invoice.
 */
export async function createPaymentIntent(input: CreateIntentInput): Promise<IntentResult> {
  if (!(await anyProviderEnabled())) {
    throw new PaymentIntentError("No payment provider is enabled. Configure one in Settings → Payments.");
  }

  // Server-side ownership + balance.
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, organizationId: true, amount: true, currency: true, status: true, subscriptionId: true },
  });
  if (!invoice) throw new PaymentIntentError("Invoice not found");
  if (invoice.organizationId !== input.organizationId) {
    throw new PaymentIntentError("Invoice does not belong to this organization");
  }
  if (invoice.status === "paid" || invoice.status === "void" || invoice.status === "refunded") {
    throw new PaymentIntentError("Invoice is already settled");
  }
  const paidAgg = await prisma.payment.aggregate({ where: { invoiceId: invoice.id, status: "succeeded" }, _sum: { amount: true } });
  const outstanding = invoice.amount - (paidAgg._sum.amount ?? 0);
  if (outstanding <= 0) throw new PaymentIntentError("Invoice has no outstanding balance");

  // Reuse an open intent for this invoice to keep checkout idempotent — but an
  // EXPIRED intent is terminal (abandoned checkout) and leaves the invoice
  // outstanding: close it and let a fresh checkout be created.
  const existingOpen = await prisma.paymentIntent.findFirst({
    where: { invoiceId: invoice.id, status: { in: ["created", "requires_payment", "processing"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existingOpen) {
    if (existingOpen.expiresAt && existingOpen.expiresAt.getTime() < Date.now()) {
      await prisma.paymentIntent.update({ where: { id: existingOpen.id }, data: { status: "expired" } });
    } else {
      return serializeIntent(existingOpen);
    }
  }

  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { country: true } });
  const adapter = await resolveProvider({
    country: org?.country ?? input.organizationId.length ? (org?.country ?? null) : null,
    currency: invoice.currency,
    method: (input.method as never) || undefined,
  });
  if (!adapter) {
    throw new PaymentIntentError(`No enabled provider supports ${invoice.currency}${input.method ? ` / ${input.method}` : ""} for this organization`);
  }
  const provider = adapter.config;
  if (!canRoutePayment(provider.integrationStatus, provider.enabled)) {
    throw new PaymentIntentError(`Provider "${provider.id}" is not activated for checkout (${provider.integrationStatus})`);
  }

  const idempotencyKey = `int_${randomUUID()}`;
  const now = new Date();
  const ttlMs = provider.mode === "test" ? 900_000 : 3_600_000;
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Persist the intent first (so a webhook arriving before checkout response
  // still has a row to reconcile against).
  const pendingRef = `pending_${randomUUID()}`;
  const intent = await prisma.paymentIntent.create({
    data: {
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      provider: provider.id,
      amount: outstanding,
      currency: invoice.currency,
      status: "created",
      idempotencyKey,
      providerRef: pendingRef,
      method: input.method || null,
      expiresAt,
      rawMeta: { method: input.method || null },
    },
  });

  let checkout: PaymentCheckout;
  try {
    checkout = await adapter.createCheckout({
      intentId: intent.id,
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      amountMinor: outstanding,
      currency: invoice.currency,
      method: (input.method as never) || undefined,
      // Deterministic server-derived success URL — the provider always returns
      // to the checkout status page, which never trusts the browser and only
      // reports paid once a verified webhook reconciles the payment.
      returnUrl: input.returnUrl || `/customer/checkout/${intent.id}`,
      cancelUrl: input.cancelUrl || `/customer/billing`,
      idempotencyKey,
    });
  } catch (e) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "failed", failureReason: e instanceof Error ? e.message : "Checkout initiation failed" },
    });
    throw e instanceof PaymentIntentError ? e : new PaymentIntentError(e instanceof Error ? e.message : "Checkout initiation failed");
  }

  const updated = await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: "requires_payment",
      providerRef: checkout.providerRef,
      checkoutUrl: checkout.checkoutUrl,
      clientToken: checkout.clientToken,
      expiresAt: checkout.expiresAtMs ? new Date(checkout.expiresAtMs) : expiresAt,
      rawMeta: { ...(intent.rawMeta as Record<string, unknown>), providerRef: checkout.providerRef },
    },
  });

  await writeSaasAudit({
    byEmail: input.actorEmail,
    action: "payments.intent_created",
    entity: "payment_intent",
    entityId: intent.id,
    detail: `${(outstanding / 100).toFixed(2)} ${invoice.currency} via ${provider.id} for invoice ${invoice.id}`,
    ip: input.ip,
  });
  return serializeIntent(updated);
}

export async function getIntent(intentId: string) {
  return prisma.paymentIntent.findUnique({ where: { id: intentId } });
}

/** Mark an intent terminal from a webhook reconcile. */
export async function markIntentResult(
  intentId: string,
  result: { status: string; paymentId?: string | null; failureReason?: string | null },
): Promise<void> {
  await prisma.paymentIntent.update({
    where: { id: intentId },
    data: {
      status: result.status,
      completedAt: new Date(),
      settledPaymentId: result.paymentId ?? undefined,
      failureReason: result.failureReason ?? undefined,
    },
  });
}

function serializeIntent(intent: Awaited<ReturnType<typeof getIntent>>): IntentResult {
  return {
    intentId: intent!.id,
    provider: intent!.provider,
    amountMinor: intent!.amount,
    currency: intent!.currency,
    status: intent!.status,
    checkoutUrl: intent!.checkoutUrl,
    clientToken: intent!.clientToken,
    providerRef: intent!.providerRef,
    expiresAtMs: intent!.expiresAt ? intent!.expiresAt.getTime() : null,
  };
}
