"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * Claim form for a property listing. Real claims are submitted server-side
 * against the signed-in user's organization via POST /api/customer/properties/claim
 * and only apply to live Google listings (`place:<placeId>`). Demo slugs cannot
 * be claimed — this form guides the visitor to a live listing or to sign in.
 */
export default function ClaimForm({ slug, propertyName }: { slug: string; propertyName: string }) {
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "submitted" | "error">("idle");
  const [message, setMessage] = useState("");

  const isLive = slug.startsWith("place:");

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

  if (!isLive) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/40">
        <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Claiming {propertyName}
        </h2>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Claims are available for live Google listings. Search for your property
          to see its live listing and claim it from there.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
        >
          Search for your property
        </Link>
      </div>
    );
  }

  if (auth === "loading") {
    return <div className="text-sm text-zinc-500">Checking account…</div>;
  }

  if (state === "submitted") {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40"
      >
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          Claim request submitted
        </h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
        <Link
          href="/customer"
          className="mt-4 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Track it in your customer portal
        </Link>
      </div>
    );
  }

  if (auth === "out") {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-center dark:border-indigo-900 dark:bg-indigo-950/40">
        <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
          Own {propertyName}?
        </h2>
        <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">
          Sign in with your organization account to claim this listing and unlock owner tools.
        </p>
        <Link
          href="/account"
          className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Sign in to claim
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Claim {propertyName}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Verify ownership of this Google listing. An admin will review your request.
        </p>
      </div>
      <button
        onClick={submit}
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Submitting…" : "Submit claim request"}
      </button>
      {state === "error" && <p className="text-center text-sm text-red-500">{message}</p>}
      {message && state === "idle" && <p className="text-center text-xs text-zinc-500">{message}</p>}
      <p className="text-center text-xs text-zinc-400">
        Claims are reviewed by our team and verified against the Google listing.
      </p>
    </div>
  );
}
