"use client";

import { useState } from "react";
import Link from "next/link";
import { properties } from "@/lib/data";

export default function ClaimForm({
  slug,
  propertyName,
}: {
  slug: string;
  propertyName: string;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const valid = /^\S+@\S+\.\S+$/.test(email) && phone.trim().length >= 7 && agree;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    // Simulated verification handshake — replace with your own backend / GBP API.
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
      try {
        const claimed = JSON.parse(localStorage.getItem("hospiscore-claimed") ?? "{}");
        claimed[slug] = true;
        localStorage.setItem("hospiscore-claimed", JSON.stringify(claimed));
      } catch {
        /* ignore storage errors in demo */
      }
    }, 900);
  }

  if (done) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40"
      >
        <svg
          className="mx-auto h-10 w-10 text-emerald-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          Claim request submitted
        </h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          In production this would kick off Google Business Profile verification for{" "}
          {propertyName}.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/properties/${slug}`}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Back to score
          </Link>
          <Link
            href={`/properties/${slug}/dashboard`}
            className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
          >
            Open owner dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Work email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@example.com"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-indigo-900"
        />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          On-file phone
        </label>
        <input
          id="phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 000 0000"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-indigo-900"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          I confirm I am the owner or an authorized manager of {propertyName} and accept
          the demo verification terms.
        </span>
      </label>
      <button
        type="submit"
        disabled={!valid || submitting}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Verifying…" : "Submit claim request"}
      </button>
      <p className="text-center text-xs text-zinc-400">
        Demo uses simulated verification. {properties.length} sample properties available.
      </p>
    </form>
  );
}