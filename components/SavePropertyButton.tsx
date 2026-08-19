"use client";

import { useEffect, useState } from "react";

/**
 * Client save/unsave button for the property page. When the owner is signed
 * out it degrades to a "Sign in to save" link to /account.
 */
export default function SavePropertyButton({ slug }: { slug: string }) {
  const [status, setStatus] = useState<"loading" | "guest" | "saved" | "unsaved">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (!me.user) {
        setStatus("guest");
        return;
      }
      const res = await fetch("/api/saved").then((r) => r.json());
      setStatus(res.saved?.some((s: { slug: string }) => s.slug === slug) ? "saved" : "unsaved");
    })();
  }, [slug]);

  async function toggle() {
    setBusy(true);
    try {
      if (status === "saved") {
        await fetch(`/api/saved/${slug}`, { method: "DELETE" });
        setStatus("unsaved");
      } else {
        await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        setStatus("saved");
      }
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <span className="flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-400">
        …
      </span>
    );
  }

  if (status === "guest") {
    return (
      <a
        href="/account"
        className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300"
      >
        Sign in to save
      </a>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        status === "saved"
          ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
          : "border border-zinc-300 text-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-200"
      }`}
    >
      {status === "saved" ? "Saved ★" : "Save"}
    </button>
  );
}