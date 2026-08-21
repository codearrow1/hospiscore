"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type SavedView = { name: string; query: string };

const STORAGE_KEY = "marketing.leadViews";

export default function SavedViews() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setViews(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: SavedView[]) => {
    setViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const currentQuery = sp.toString();
  const save = () => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    const next = [...views.filter((v) => v.name !== trimmed), { name: trimmed, query: currentQuery }];
    persist(next);
    setName("");
  };

  const load = (query: string) => {
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const remove = (n: string) => {
    persist(views.filter((v) => v.name !== n));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs font-semibold text-zinc-500">Saved views:</span>
      {views.length === 0 && <span className="text-xs text-zinc-400">none yet — save the current filters</span>}
      {views.map((v) => (
        <span
          key={v.name}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800"
        >
          <button onClick={() => load(v.query)} className="hover:text-indigo-600 dark:hover:text-indigo-400">
            {v.name}
          </button>
          <button
            onClick={() => remove(v.name)}
            aria-label={`Delete ${v.name}`}
            className="ml-1 text-zinc-400 hover:text-red-500"
          >
            ×
          </button>
        </span>
      ))}
      <div className="ml-auto flex items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name"
          className="w-32 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={save}
          disabled={!name.trim()}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
