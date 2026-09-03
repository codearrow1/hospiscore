"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Claim CTA for a live Google listing (place:<placeId>).
 *
 * Signed-in users claim their organization's listing directly via the customer
 * API. Logged-out users are offered a short contact capture (name/email/phone)
 * which mints a one-time, expiring property-claim request token server-side,
 * then carries it through registration/login (?claim=token&next=…). The token
 * is what authorizes creating the PropertyClaim — listidentity is resolved
 * server-side from Google, never from the client.
 */
export default function PropertyClaimCTA({ slug }: { slug: string }) {
  const router = useRouter();
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "submitted" | "error" | "started">("idle");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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

  const submitClaim = useCallback(async () => {
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

  const startClaim = useCallback(async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState("error");
      setMessage("Enter a valid email address to continue.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/properties/claim/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(d.error ?? "Could not start your claim.");
        return;
      }
      setState("started");
      const next = `/property/${encodeURIComponent(slug)}`;
      const target = `/account?claim=${encodeURIComponent(d.claimToken)}&next=${encodeURIComponent(next)}`;
      router.push(target);
    } catch {
      setState("error");
      setMessage("Network error starting your claim. Try again.");
    } finally {
      setBusy(false);
    }
  }, [slug, name, email, phone, router]);

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
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">{auth === "in" ? "Claim not submitted" : "Could not start claim"}</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">{message}</p>
          <button
            onClick={auth === "in" ? submitClaim : startClaim}
            disabled={busy}
            className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {busy ? "Working…" : "Try again"}
          </button>
        </div>
      ) : auth === "out" ? (
        <div>
          <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Own this listing?</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">
            Verify ownership and unlock review-response tracking and an owner dashboard. Start your claim — we&apos;ll guide you through a quick sign-in.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startClaim();
            }}
            className="mt-3 flex flex-col gap-2"
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              autoComplete="name"
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              required
              autoComplete="email"
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (for verification, optional)"
              autoComplete="tel"
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              {busy ? "Starting…" : "Start your claim"}
            </button>
            {message && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{message}</p>}
          </form>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Own this listing?</h2>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">
            Claim it to verify ownership and unlock review-response tracking and an owner dashboard.
          </p>
          <button
            onClick={submitClaim}
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
