"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * Claim CTA for a live Google listing (place:<placeId>). Submits a property
 * claim against the signed-in user's organization via the customer API. The
 * listing identity is resolved server-side from Google — never from the client.
 */
export default function PropertyClaimCTA({ slug }: { slug: string }) {
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "submitted" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (!disposed) setAuth(d?.user ? "in" : "out");
      } catch {
        if (!disposed) setAuth("out");
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/customer/properties/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        setAuth("out");
        setState("idle");
        setMessage("Please sign in with your organization account to claim this listing.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setMessage(d.error ?? "Claim could not be submitted.");
        return;
      }
      setState("submitted");
      setMessage(`Claim submitted — status: ${d.claim?.status ?? "pending"}. An admin will review it.`);
    } catch {
      setState("error");
      setMessage("Network error submitting the claim. Try again.");
    } finally {
      setBusy(false);
    }
  }, [slug]);

  if (auth === "loading") {
    return <div className="text-sm text-zinc-500">Checking account…</div>;
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
      {state === "submitted" ? (
        <div>
          <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Claim request submitted</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">{message}</p>
          <Link href="/customer" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
            Track it in your customer portal
          </Link>
        </div>
      ) : state === "error" ? (
        <div>
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Claim not submitted</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">{message}</p>
          <button
            onClick={submit}
            disabled={busy}
            className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? "Submitting…" : "Try again"}
          </button>
        </div>
      ) : auth === "out" ? (
        <div>
          <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Own this listing?</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">
            Sign in with your organization account to claim this property and unlock owner tools.
          </p>
          <Link
            href="/account"
            className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            Sign in to claim
          </Link>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Own this listing?</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">
            Claim it to verify ownership and unlock review-response tracking and an owner dashboard.
          </p>
          <button
            onClick={submit}
            disabled={busy}
            className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? "Submitting…" : "Claim this listing"}
          </button>
          {message && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{message}</p>}
        </div>
      )}
    </div>
  );
}
