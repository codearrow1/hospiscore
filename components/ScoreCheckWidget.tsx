"use client";

import { useEffect, useRef, useState, useId, type FormEvent } from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/resolver";
import ScoreGauge from "@/components/ScoreGauge";

interface ComponentRow {
  key: string;
  label: string;
  score: number;
  weight: number;
}

interface ScoreData {
  overall: number;
  grade: string;
  gradeColor: string;
  totalReviews: number;
  platformsCount: number;
  dataCompleteness: number;
  components: ComponentRow[];
}

interface SearchResponse {
  mode: "live" | "demo";
  results: SearchResult[];
}

interface LeadState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

type PrefetchState = "idle" | "loading" | "ready" | "failed";

const FALLBACK_BARS = [82, 64, 45, 71];

const INCLUDE_CHECKS = [
  "13 weighted signals",
  "Strengths & watchouts",
  "Prioritized fixes",
];

function SearchIcon() {
  return (
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
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function gradeTone(score: number) {
  if (score >= 70) return "text-emerald-400 bg-emerald-500/15";
  if (score >= 50) return "text-amber-400 bg-amber-500/15";
  return "text-rose-400 bg-rose-500/15";
}

function barTone(score: number) {
  if (score >= 70) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  if (score >= 50) return "bg-gradient-to-r from-amber-500 to-amber-400";
  return "bg-gradient-to-r from-rose-500 to-rose-400";
}

/** The weakest component below 60 and the points fixing it to 60 would add. */
function biggestLever(components: ComponentRow[]) {
  if (!components.length) return null;
  const weak = [...components].sort((a, b) => a.score - b.score)[0];
  if (weak.score >= 60) return null;
  const lift = Math.max(1, Math.round((60 - weak.score) * weak.weight));
  return { label: weak.label, score: weak.score, lift };
}

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900";

/** Live search → free score teaser → email-gated full breakdown. */
export default function ScoreCheckWidget() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [unlocked, setUnlocked] = useState<ScoreData | null>(null);
  const [lead, setLead] = useState<LeadState>({ status: "idle" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [prefetch, setPrefetch] = useState<{ state: PrefetchState; data: ScoreData | null }>({
    state: "idle",
    data: null,
  });
  const inputId = useId();
  const unlockRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults(null);
        setMode(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as SearchResponse;
        setResults(data.results);
        setMode(data.mode);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Could not load results. Try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  /** Prefetch the breakdown on selection so the locked teaser shows real lures. */
  useEffect(() => {
    if (!selected) return;
    const seq = ++seqRef.current;
    setPrefetch({ state: "loading", data: null });
    const controller = new AbortController();
    fetch(`/api/properties/${encodeURIComponent(selected.id)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (seqRef.current !== seq) return;
        if (!res.ok) throw new Error(`prefetch ${res.status}`);
        const payload = (await res.json()) as { score: ScoreData };
        if (seqRef.current === seq) setPrefetch({ state: "ready", data: payload.score });
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        if (seqRef.current === seq) setPrefetch({ state: "failed", data: null });
      });
    return () => controller.abort();
  }, [selected]);

  function pick(r: SearchResult) {
    setSelected(r);
    setUnlocked(null);
    setLead({ status: "idle" });
    setName("");
    setEmail("");
    setPhone("");
    setPhoneErr(null);
    setTimeout(() => unlockRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected || lead.status === "loading") return;
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && digits.length < 7) {
      setPhoneErr("Enter a valid phone number (7+ digits)");
      return;
    }
    setPhoneErr(null);
    setLead({ status: "loading" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, propertySlug: selected.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLead({ status: "error", message: data.error ?? "Something went wrong. Try again." });
        return;
      }
      let score = prefetch.data;
      if (!score) {
        const detail = await fetch(`/api/properties/${encodeURIComponent(selected.id)}`, {
          cache: "no-store",
        });
        if (detail.ok) score = ((await detail.json()) as { score: ScoreData }).score;
      }
      setUnlocked(
        score ?? {
          overall: selected.overall,
          grade: "",
          gradeColor: "",
          totalReviews: selected.totalReviews,
          platformsCount: selected.platformsCount,
          dataCompleteness: 0,
          components: [],
        },
      );
      setLead({ status: "success" });
      setTimeout(
        () => unlockRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        80,
      );
    } catch {
      setLead({ status: "error", message: "Could not reach the server. Try again." });
    }
  }

  const bars =
    unlocked && unlocked.components.length > 0
      ? [...unlocked.components].sort((a, b) => a.score - b.score)
      : null;

  const lever = biggestLever(prefetch.data?.components ?? []);
  const teaserBars =
    prefetch.state === "ready" && prefetch.data
      ? [...prefetch.data.components].sort((a, b) => a.score - b.score)
      : null;

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any hotel, resort or B&B worldwide… e.g. Hilton Tokyo"
          aria-label="Search properties worldwide"
          autoComplete="off"
          className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 py-4 pl-12 pr-4 text-base text-zinc-50 shadow-inner outline-none transition placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900"
        />
        <SearchIcon />
      </div>

      <div className="mt-3 flex min-h-5 items-center justify-between text-xs text-zinc-400">
        <span aria-live="polite">
          {loading
            ? "Searching live data…"
            : results !== null
              ? `${results.length} result${results.length === 1 ? "" : "s"} found`
              : "\u00A0"}
        </span>
        {mode && !loading && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              mode === "live"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-zinc-700/50 text-zinc-400"
            }`}
          >
            {mode === "live" ? "● Live Google data" : "Demo"}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {results !== null && !selected && !error && (
        <ul className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {results.length === 0 && loading === false && (
            <li className="rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">
              No properties match “{query}”. Try a city like Paris or Bali.
            </li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition hover:border-indigo-600 hover:bg-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-sm font-bold text-indigo-300">
                    {r.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-50">{r.name}</div>
                    <div className="truncate text-xs text-zinc-400">
                      {r.type} · {r.city}, {r.country}
                      {r.isLive ? (
                        <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                          live
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-zinc-500 sm:block">
                    {r.totalReviews.toLocaleString("en-US")} reviews
                  </span>
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${gradeTone(r.overall)}`}
                  >
                    {r.overall}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div ref={unlockRef} className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
          <p className="sr-only" aria-live="polite">
            {selected.name}: overall score {unlocked?.overall ?? selected.overall} out of 100
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="order-2 w-full min-w-0 sm:order-1 sm:w-auto">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
                {unlocked ? "Full report unlocked" : "Free score preview"}
              </p>
              <h2 className="mt-1 truncate text-lg font-bold text-zinc-50">{selected.name}</h2>
              <p className="text-sm text-zinc-400">
                {selected.type} · {selected.city}, {selected.country}
              </p>
            </div>
            <div className="order-1 flex w-full shrink-0 items-center justify-between gap-4 sm:order-2 sm:w-auto">
              <div className="text-left text-xs text-zinc-500 sm:text-right">
                {unlocked?.grade && (
                  <p className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${unlocked.gradeColor}`}>
                    Grade {unlocked.grade}
                  </p>
                )}
                <p>
                  {selected.totalReviews.toLocaleString("en-US")} reviews
                  <br />
                  {selected.isLive ? "live Google score" : "estimated score"}
                </p>
              </div>
              <ScoreGauge score={unlocked?.overall ?? selected.overall} size={96} />
            </div>
          </div>

          <div className="mt-5">
            {unlocked ? (
              <div className="space-y-4">
                {lever && (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                    <p className="text-sm font-bold text-amber-300">
                      Biggest lever: {lever.label} ({lever.score}/100)
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Bringing it to 60 could add ~<span className="font-bold text-amber-200">+{lever.lift} points</span>{" "}
                      to the overall score.
                    </p>
                  </div>
                )}
                {bars ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {unlocked.components
                        .filter((c) => c.score >= 70)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 2)
                        .map((c) => (
                          <span
                            key={c.key}
                            className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400"
                          >
                            ✓ {c.label}
                          </span>
                        ))}
                      {unlocked.components
                        .filter((c) => c.score < 50)
                        .sort((a, b) => a.score - b.score)
                        .slice(0, 2)
                        .map((c) => (
                          <span
                            key={c.key}
                            className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-400"
                          >
                            ! {c.label}
                          </span>
                        ))}
                    </div>
                    {bars.map((c) => (
                      <div key={c.key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-zinc-300">{c.label}</span>
                          <span className="tabular-nums font-semibold text-zinc-100">{c.score}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full ${barTone(c.score)}`}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-500">
                        {unlocked.platformsCount} platforms · {unlocked.dataCompleteness}% data
                        coverage · {unlocked.totalReviews.toLocaleString("en-US")} reviews
                      </p>
                      <Link
                        href={
                          selected.isLive
                            ? `/property/${selected.id}`
                            : `/properties/${selected.slug}`
                        }
                        className="btn-shine inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                      >
                        Open full report
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M3 10a.75.75 0 0 1 .75-.75h10.6L10.6 5.4a.75.75 0 1 1 1.06-1.06l4.97 4.97a.75.75 0 0 1 0 1.06l-4.97 4.97a.75.75 0 0 1-1.06-1.06l3.75-3.75H3.75A.75.75 0 0 1 3 10Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                    The full signal breakdown wasn&apos;t available for this property — but the
                    complete report with every score has been emailed to you.
                  </p>
                )}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
                <div className="relative">
                {prefetch.state === "loading" || prefetch.state === "idle" ? (
                  <div className="space-y-3 p-5" aria-hidden="true">
                    {FALLBACK_BARS.map((w, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="mb-1 flex items-center justify-between">
                          <div className="h-2.5 w-28 rounded bg-zinc-800" />
                          <div className="h-2.5 w-8 rounded bg-zinc-800" />
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-indigo-500/60"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pointer-events-none select-none p-5" aria-hidden="true">
                    {(teaserBars ?? FALLBACK_BARS.map((w) => ({ score: w }))).map((c, i) => (
                      <div key={i} className="mb-3">
                        <div className="mb-1 flex items-center justify-between">
                          <div className="h-2.5 w-28 rounded bg-zinc-700/80" />
                          <div className="h-2.5 w-8 rounded bg-zinc-700/80" />
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full opacity-80 ${barTone(c.score)}`}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950/95 via-zinc-950/40 to-transparent"
                    aria-hidden="true"
                  />
                </div>

                <div className="relative border-t border-zinc-800 px-5 py-5 text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                    <LockIcon />
                  </span>
                  <p className="mt-3 text-base font-bold text-zinc-50">
                    Unlock the full score breakdown
                  </p>
                  {lever ? (
                    <div className="mx-auto mt-2 max-w-sm rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-300">
                        ⚠ {lever.label} is dragging the score down
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-300">
                        Fixing it could add ~<span className="font-bold text-amber-200">+{lever.lift} points</span> —
                        see exactly how in the full report.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-400">
                      Enter your details to see every signal, strengths and what to fix first.
                    </p>
                  )}
                </div>

                <form onSubmit={onSubmit} className="relative z-10 border-t border-zinc-800 bg-zinc-950/40 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Your name"
                      aria-label="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="Work email"
                      aria-label="Work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="mt-3">
                    <input
                      type="tel"
                      autoComplete="tel"
                      placeholder="Phone number (optional — for your report call)"
                      aria-label="Phone number"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (phoneErr) setPhoneErr(null);
                      }}
                      className={inputClass}
                    />
                    {phoneErr && (
                      <p role="alert" className="mt-1.5 text-xs text-red-400">
                        {phoneErr}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={lead.status === "loading"}
                    className="btn-shine mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {lead.status === "loading" ? "Unlocking…" : "Reveal my full score — free"}
                  </button>
                  {lead.status === "error" && (
                    <p
                      role="alert"
                      className="mt-3 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"
                    >
                      {lead.message}
                    </p>
                  )}
                  {lead.status === "success" && (
                    <p
                      role="status"
                      className="mt-3 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"
                    >
                      ✓ Unlocked — the full report is also on its way to {email.trim()} inbox.
                    </p>
                  )}
                  <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {INCLUDE_CHECKS.map((c) => (
                      <li key={c} className="inline-flex items-center gap-1">
                        <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-center text-xs text-zinc-600">
                    Used to send this report and one follow-up. No spam, unsubscribe anytime.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}