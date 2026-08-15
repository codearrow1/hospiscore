"use client";

import { useState } from "react";

/**
 * Book-a-demo form. Validates client-side, POSTs to /api/demo and shows a
 * confirmation card on success. Works on the /demo page and marketing CTAs.
 */
export default function BookDemoForm({ compact = false }: { compact?: boolean }) {
  const [values, setValues] = useState({
    name: "",
    email: "",
    company: "",
    propertyName: "",
    propertyCount: "1-5",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ name: string; id: string } | null>(null);

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          company: values.company,
          propertyName: values.propertyName,
          propertyCount:
            values.propertyCount === "1-5"
              ? 3
              : values.propertyCount === "6-20"
                ? 13
                : values.propertyCount === "21-100"
                  ? 60
                  : 250,
          message: values.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit — try again.");
      setDone({ name: values.name.split(" ")[0], id: data.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
          ✓
        </div>
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          Thanks {done.name} — you&apos;re booked in.
        </h3>
        <p className="mt-2 text-sm text-emerald-800/80 dark:text-emerald-300/80">
          Our team will reach out within one business day to schedule your
          personalized HospiOS walkthrough (reference{" "}
          <span className="font-mono text-xs">{done.id.slice(0, 8)}</span>).
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  const labelCls = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <form onSubmit={submit} className={`flex flex-col gap-4 ${compact ? "" : "text-left"}`}>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Full name *</span>
          <input required value={values.name} onChange={(e) => set("name", e.target.value)} className={inputCls} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Work email *</span>
          <input required type="email" value={values.email} onChange={(e) => set("email", e.target.value)} className={inputCls} autoComplete="email" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Company / brand</span>
          <input value={values.company} onChange={(e) => set("company", e.target.value)} className={inputCls} autoComplete="organization" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Your main property</span>
          <input value={values.propertyName} onChange={(e) => set("propertyName", e.target.value)} className={inputCls} placeholder="e.g. Harbor Lights Inn" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Properties you manage</span>
          <select value={values.propertyCount} onChange={(e) => set("propertyCount", e.target.value)} className={inputCls}>
            <option value="1-5">1 – 5</option>
            <option value="6-20">6 – 20</option>
            <option value="21-100">21 – 100</option>
            <option value="100+">100+</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>What should we focus on?</span>
          <select value={values.message === "" ? "" : values.message} onChange={(e) => set("message", e.target.value)} className={inputCls}>
            <option value="">Review &amp; reputation</option>
            <option value="online presence score">Online presence score</option>
            <option value="ai reply drafts">AI reply drafts</option>
            <option value="owner dashboard">Owner dashboard &amp; alerts</option>
            <option value="platform consolidation">Platform consolidation</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Anything else we should know?</span>
        <textarea
          rows={3}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          className={`${inputCls} resize-y`}
          placeholder="Tell us about your properties, channels, or goals…"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Booking…" : "Book my demo"}
      </button>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        No spam, ever. We only use your details to set up the demo.
      </p>
    </form>
  );
}