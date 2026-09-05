"use client";

import { useState } from "react";
import type { ReviewRecord } from "@/lib/nlp";

interface Props {
  review: Pick<ReviewRecord, "text" | "platform" | "rating" | "author" | "id">;
  propertyName: string;
}

export default function ReplyGenerator({ review, propertyName }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [source, setSource] = useState<"deepseek" | "template">("template");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyName,
          review: {
            text: review.text,
            platform: review.platform,
            rating: review.rating,
            author: review.author,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate reply");
      setDraft(data.reply);
      setSource(data.source);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      {draft ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            aria-label="Reply draft"
            className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-700 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            <span className={source === "deepseek" ? "text-sky-500" : ""}>
              {source === "deepseek" ? "Generated with DeepSeek" : "Offline template"}
            </span>
            <button
              onClick={copy}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Drafting…" : "Draft a reply"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}