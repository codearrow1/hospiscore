"use client";

import { useState } from "react";

interface SubmitState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  emailed?: boolean;
}

/**
 * Lead-capture card rendered on property score pages (and inline on the home
 * hero). A visitor trades an e-mail address for the full score report of the
 * property in their inbox.
 */
export default function ReportEmailForm({
  propertySlug,
  propertyName,
  variant = "card",
}: {
  propertySlug: string;
  propertyName: string;
  /** "card" = bordered panel; "inline" = tighter indigo panel for the hero band. */
  variant?: "card" | "inline";
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const wrapClass =
    variant === "inline"
      ? "rounded-2xl border border-indigo-900/70 bg-indigo-950/40 p-5"
      : "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, propertySlug }),
      });
      const data = (await res.json()) as {
        error?: string;
        emailed?: boolean;
      };
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Something went wrong. Try again." });
        return;
      }
      setState({
        status: "success",
        emailed: data.emailed,
        message: data.emailed === false ? undefined : email.trim().toLowerCase(),
      });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Try again." });
    }
  }

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              {state.emailed === false
                ? "Report saved — we’ll email it shortly."
                : `Report sent to ${state.message}`}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              The full report for {propertyName} is on its way. One of our hospitality
              specialists may reach out to help you act on it — no spam, ever.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Get the full report in your inbox
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        We’ll email the complete score report for {propertyName} — strengths,
        watchouts and what to fix first — so you can share it with your team.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="report-name" className="sr-only">
            Your name
          </label>
          <input
            id="report-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-indigo-900"
          />
        </div>
        <div>
          <label htmlFor="report-email" className="sr-only">
            Work email
          </label>
          <input
            id="report-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-indigo-900"
          />
        </div>
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.status === "loading" ? "Sending…" : "Email me the report"}
        </button>
        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {state.message}
          </p>
        )}
        <p className="text-xs text-zinc-400">
          Used only to send this report and follow up once. Unsubscribe anytime.
        </p>
      </form>
    </div>
  );
}
