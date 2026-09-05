"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { type: string; id: string; title: string; subtitle?: string; href: string };

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        setResults(d.results);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 md:inline-flex"
        aria-label="Global search Cmd+K"
      >
        <span>⌘K</span> Search
      </button>
      <button onClick={() => setOpen(true)} className="rounded-xl border bg-white p-2 text-sm dark:bg-zinc-900 md:hidden">⌘K</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border bg-white p-4 shadow-2xl dark:bg-zinc-900 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Organization, Property, Subscription, Invoice, Payment, Lead…"
              className="w-full rounded-xl border bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:border-zinc-700"
            />
            <div className="mt-3 max-h-[50vh] overflow-auto">
              {loading && <p className="p-2 text-sm text-zinc-500">Searching…</p>}
              {!loading && q.length >= 2 && results.length === 0 && <p className="p-2 text-sm text-zinc-500">No results for “{q}”</p>}
              {!loading && results.map((r) => (
                <button key={`${r.type}-${r.id}`} onClick={() => go(r.href)} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <span>
                    <span className="block text-sm font-medium">{r.title}</span>
                    {r.subtitle && <span className="block text-xs text-zinc-500">{r.subtitle}</span>}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase dark:bg-zinc-800">{r.type}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-400">Press Esc to close · <code>⌘K</code> to toggle</p>
          </div>
        </div>
      )}
    </>
  );
}
