"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface IntentStatus {
  id: string;
  provider: string | null;
  amount: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  clientToken: string | null;
  providerRef: string | null;
  settledPaymentId: string | null;
  createdAt: string;
}

const PROCESSING = new Set(["created", "requires_payment", "processing"]);
const SUCCESS = new Set(["succeeded"]);
const FAILED = new Set(["failed", "cancelled", "expired"]);

/**
 * Polls intent status. Shows "Payment processing … Payment is being verified"
 * while a webhook confirmation has not yet landed; only a reconciled
 * `succeeded` status is shown as paid.
 */
export default function CheckoutStatusClient({ intentId }: { intentId: string }) {
  const [state, setState] = useState<IntentStatus | null>(null);
  const [missing, setMissing] = useState(false);
  const polled = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const res = await fetch(`/api/customer/payments/${intentId}`).catch(() => null);
      if (!res?.ok) {
        setMissing(true);
        return;
      }
      const d = await res.json().catch(() => ({}));
      const intent = (d as { intent?: IntentStatus }).intent;
      if (!intent) {
        setMissing(true);
        return;
      }
      setState(intent);
      if (SUCCESS.has(intent.status) || FAILED.has(intent.status)) {
        return; // terminal — stop polling
      }
      polled.current += 1;
      if (polled.current < 600) {
        timer = setTimeout(poll, 3000);
      }
    };
    void poll();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [intentId]);

  if (missing) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold">Payment</h1>
        <p className="mt-2 text-sm text-zinc-500">We could not load this payment. It may not exist for your organization.</p>
        <Link href="/customer" className="mt-4 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">Back to portal</Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <p className="text-sm text-zinc-500">Checking payment status…</p>
      </div>
    );
  }

  // Currently processing — never claim paid until webhook confirms.
  if (PROCESSING.has(state.status)) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <h1 className="text-xl font-bold">Payment processing</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Your payment is being verified. Do not close this page — the final status is confirmed by a secure webhook. If you were redirected back from the payment provider, the confirmation may take a few seconds.
        </p>
      </div>
    );
  }

  if (SUCCESS.has(state.status)) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">✓</div>
        <h1 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">Payment confirmed</h1>
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          Your payment of {state.currency} {state.amount} was verified and your invoice is settled.
        </p>
        <Link href="/customer" className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-300">Back to portal</Link>
      </div>
    );
  }

  if (FAILED.has(state.status)) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm dark:border-rose-900 dark:bg-rose-950/40">
        <h1 className="text-xl font-bold text-rose-700 dark:text-rose-200">Payment not completed</h1>
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
          Your payment could not be completed ({state.status}). No charge was applied to your account.
        </p>
        <Link href="/customer/invoices" className="mt-4 inline-block text-sm font-semibold text-rose-700 underline dark:text-rose-300">Back to invoices</Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">Payment status: {state.status}</h1>
      <Link href="/customer" className="mt-4 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">Back to portal</Link>
    </div>
  );
}
