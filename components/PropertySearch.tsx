"use client";

import { useEffect, useRef, useState, useId } from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/resolver";
import { loadMapsApi, attachAutocomplete } from "@/lib/client/maps-loader";
import ReportEmailForm from "@/components/ReportEmailForm";

interface SearchResponse {
  mode: "live" | "demo";
  results: SearchResult[];
}

/** Public client key (inlined at build); empty string → no autocomplete. */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export default function PropertySearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [focused, setFocused] = useState<SearchResult | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected || !captureRef.current) return;
    captureRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  // Places Autocomplete (only when a client Maps key is configured).
  useEffect(() => {
    if (!MAPS_KEY) return;
    let disposed = false;
    let detach: (() => void) | undefined;
    (async () => {
      try {
        await loadMapsApi(MAPS_KEY);
        if (disposed || !inputRef.current) return;
        detach = attachAutocomplete(inputRef.current, async (placeId, name) => {
          const res = await fetch(`/api/properties/place:${encodeURIComponent(placeId)}`);
          if (!res.ok) return;
          const data = (await res.json()) as {
            property?: {
              slug: string;
              name: string;
              city: string;
              country: string;
              type: string;
              claimed: boolean;
            };
            score?: { overall: number; platformsCount: number; totalReviews: number };
            mode?: "live" | "demo";
          };
          if (!data.property || !data.score) return;
          setFocused({
            id: data.property.slug,
            slug: data.property.slug,
            name: name || data.property.name,
            city: data.property.city,
            country: data.property.country,
            type: data.property.type,
            claimed: data.property.claimed,
            overall: data.score.overall,
            platformsCount: data.score.platformsCount,
            totalReviews: data.score.totalReviews,
            isLive: data.mode === "live",
          });
          setMode(data.mode ?? null);
        });
      } catch (err) {
        console.error("Autocomplete unavailable, using text search:", err);
      }
    })();
    return () => {
      disposed = true;
      detach?.();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setFocused(null); // fresh query → drop any selected place card
      setSelected(null); // …and any pending e-mail capture
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as SearchResponse;
        setResults(data.results);
        setMode(data.mode);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Could not load results. Try again.");
        console.error(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function pickReport(r: SearchResult) {
    setSelected(r);
    setFocused(null);
  }

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by property name, city or country… e.g. Lisbon"
          aria-label="Search properties"
          autoComplete="off"
          className="w-full rounded-2xl border border-zinc-300 bg-white py-4 pl-12 pr-4 text-base text-zinc-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-indigo-900"
        />
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="mt-3 flex min-h-5 items-center justify-between text-xs text-zinc-400"
      >
        <span>
          {loading
            ? "Searching…"
            : results !== null
              ? `${results.length} result${results.length === 1 ? "" : "s"}`
              : "\u00A0"}
        </span>
        {mode && !loading && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              mode === "live"
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {mode === "live" ? "Live data" : "Demo data"}
          </span>
        )}
      </div>

      {loading && results === null && (
        <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="Loading results">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="h-11 w-11 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div ref={captureRef} className="mt-4 scroll-mt-24">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-50">
              Full report for{" "}
              <span className="font-semibold text-indigo-300">{selected.name}</span>
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-zinc-400 transition hover:text-zinc-200"
            >
              Choose another
            </button>
          </div>
          <ReportEmailForm
            variant="inline"
            propertySlug={selected.slug}
            propertyName={selected.name}
          />
        </div>
      )}

      {results !== null && (
        <div className="mt-4 flex flex-col gap-3">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          {focused && !error && (
            <>
              <ResultCard r={focused} compact={compact} onEmailReport={pickReport} />
              <p className="text-center text-xs text-zinc-400">
                Matched from Google Places autocomplete
              </p>
            </>
          )}
          {!loading && results.length === 0 && !focused && query && !error && (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No properties match “{query}”. Try a city like Paris or Byron Bay.
            </p>
          )}
          {!loading && results.length === 0 && !focused && !query && mode === "live" && !error && (
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Start typing a property name or city to search live data.
            </p>
          )}
          {results.map((r) => (
            <ResultCard key={r.id} r={r} compact={compact} onEmailReport={pickReport} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  r,
  compact,
  onEmailReport,
}: {
  r: SearchResult;
  compact: boolean;
  onEmailReport: (r: SearchResult) => void;
}) {
  const href = r.isLive ? `/property/${r.id}` : `/properties/${r.slug}`;
  const score = r.overall;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700">
      <Link
        href={href}
        className="group flex min-w-0 flex-1 items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-lg font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          {r.name
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </span>
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">
            {r.name}
            {r.claimed && (
              <span
                title="Verified owner"
                className="ml-2 inline-block h-3.5 w-3.5 align-middle text-emerald-500"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {r.type} · {r.city}, {r.country}
            {r.isLive && (
              <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-500 dark:bg-indigo-950 dark:text-indigo-300">
                live
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!compact && (
          <span className="hidden text-xs font-medium text-zinc-400 sm:block">
            {r.totalReviews.toLocaleString("en-US")} reviews
          </span>
        )}
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold tabular-nums ${
            score >= 70
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : score >= 50
                ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {score}
        </span>
      </div>
      </Link>
      <button
        onClick={() => onEmailReport(r)}
        className="shrink-0 rounded-xl border border-indigo-200 px-2.5 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        title={`Email the full report for ${r.name}`}
      >
        Email report
      </button>
    </div>
  );
}