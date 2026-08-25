"use client";

import { useState } from "react";
import type { PublicAuthUser } from "@/lib/accountTypes";

interface Props {
  onAuthed: (user: PublicAuthUser) => void;
}

export default function AuthCard({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Portal claim token (?claim=…) — binds a fresh registration to an existing
  // affiliate/partner/org-contact identity (one-time, minted by an admin).
  const [claimToken] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("claim")?.trim() || "" : "",
  );
  // Password-reset token (?reset=…) — switches the card into "set new password".
  const [resetToken, setResetToken] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("reset")?.trim() || "" : "",
  );
  const [showForgot, setShowForgot] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Something went wrong");
      setNotice(d.resetUrl ? `Reset link ready: ${d.resetUrl}` : d.message ?? "Check your inbox for the reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Reset failed");
      setResetToken("");
      setPassword("");
      setMode("login");
      setNotice("Password updated — sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" && claimToken
            ? { name, email, password, claimToken }
            : { name, email, password },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onAuthed(data.user as PublicAuthUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {isRegister ? "Create an owner account" : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Save properties and track your score history across visits.
      </p>

      {isRegister && claimToken && (
        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          Claim token attached — creating this account will link it to your affiliate/partner portal identity. Tokens are single-use and expire after 15 minutes.
        </p>
      )}
      {resetToken && (
        <p className="mt-3 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          Password reset — choose a new password below. The link is single-use and expires after 30 minutes.
        </p>
      )}
      {notice && (
        <p className="mt-3 break-all rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{notice}</p>
      )}

      {resetToken ? (
        <form onSubmit={confirmReset} className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Please wait…" : "Set new password"}
          </button>
        </form>
      ) : showForgot ? (
        <form onSubmit={requestReset} className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Account email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Please wait…" : "Send reset link"}
          </button>
          <button
            type="button"
            onClick={() => { setShowForgot(false); setError(null); setNotice(null); }}
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Back to sign in
          </button>
          <p className="text-xs italic text-zinc-400">
            Reset links are sent to your email address. Check your inbox (and spam folder).
          </p>
        </form>
      ) : (
        <>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
            {isRegister && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  autoComplete="name"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </label>

            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          {!isRegister && (
            <button
              onClick={() => { setShowForgot(true); setError(null); }}
              className="mt-2 w-full text-center text-xs font-medium text-zinc-500 hover:text-indigo-600 hover:underline dark:text-zinc-400"
            >
              Forgot your password?
            </button>
          )}

          <button
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError(null);
              setNotice(null);
            }}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 hover:underline dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            {isRegister ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </>
      )}
    </div>
  );
}