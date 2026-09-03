"use client";

import { useState } from "react";

interface PayIntent {
  intentId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  clientToken: string | null;
  providerRef: string | null;
  expiresAtMs: number | null;
}

const METHODS = [
  { id: "card", label: "Card" },
  { id: "upi", label: "UPI" },
  { id: "netbanking", label: "Net banking" },
  { id: "wallet", label: "Wallet" },
];

/**
 * "Pay Now" — creates a server-authoritative checkout intent and hands the
 * customer off to the provider's hosted checkout. Amount and currency are
 * always computed server-side from the invoice; the browser never sends an
 * amount. After the provider returns, the checkout status page confirms via
 * webhook-verified reconciliation (never trusts the browser).
 */
export default function PayNowButton({
  invoiceId,
  amountMinor,
  currency,
  methods = ["card"],
}: {
  invoiceId: string;
  amountMinor: number;
  currency: string;
  methods?: string[];
}) {
  const [method, setMethod] = useState<string>(methods[0] ?? "card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = METHODS.filter((m) => methods.includes(m.id));

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          method,
          returnUrl: `${window.location.origin}/customer/checkout/`,
          cancelUrl: `${window.location.origin}/customer/billing`,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((d as { error?: string }).error ?? "Checkout could not be started.");
        return;
      }
      const intent = (d as { intent?: PayIntent }).intent;
      if (!intent) {
        setError("Checkout could not be started.");
        return;
      }
      // Send the customer to the provider's hosted checkout; on completion the
      // provider's success URL returns to the checkout status page, which only
      // reports paid after a webhook-verified reconciliation.
      if (intent.checkoutUrl) {
        window.location.href = intent.checkoutUrl;
      } else {
        window.location.href = `/customer/checkout/${intent.intentId}`;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800/50 dark:bg-indigo-950/40">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Pay {currency} {amountMinor} online</p>
      {available.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                method === m.id
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-line bg-surface text-zinc-700 hover:bg-surface-subtle dark:text-zinc-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => void pay()}
        disabled={busy}
        className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? "Starting checkout…" : "Pay Now"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      <p className="mt-2 text-xs text-zinc-500">You will be taken to a secure hosted checkout. Payment status is confirmed after verification.</p>
    </div>
  );
}
