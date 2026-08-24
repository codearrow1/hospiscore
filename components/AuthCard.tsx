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
  const [loading, setLoading] = useState(false);
  // Portal claim token (?claim=…) — binds a fresh registration to an existing
  // affiliate/partner/org-contact identity (one-time, minted by an admin).
  const [claimToken] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("claim")?.trim() || "" : "",
  );

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

      <button
        onClick={() => {
          setMode(isRegister ? "login" : "register");
          setError(null);
        }}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 hover:underline dark:text-indigo-400 dark:hover:bg-indigo-950/30"
      >
        {isRegister ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}