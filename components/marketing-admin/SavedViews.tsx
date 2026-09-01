"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type SavedView = { name: string; query: string };

const STORAGE_KEY = "marketing.leadViews";
const DEFAULT_KEY = "marketing.leadViews.default";

const DEFAULT_VIEWS: SavedView[] = [
  { name: "My leads", query: "" },
  { name: "Unassigned", query: "owner=__none__" },
  { name: "Hot", query: "band=hot" },
  { name: "Overdue", query: "" },
  { name: "Won", query: "stage=won" },
  { name: "Qualified", query: "stage=qualified" },
];

/** Load from localStorage with safe fallback to the suggested defaults. */
function loadStored(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((v) => v && typeof v.name === "string" && typeof v.query === "string")) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_VIEWS;
}

export default function SavedViews() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [defaultName, setDefaultName] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Seed from storage once on mount.
  useEffect(() => {
    const loaded = loadStored();
    setViews(loaded);
    try {
      setDefaultName(localStorage.getItem(DEFAULT_KEY));
    } catch {}
  }, []);

  // Apply the saved default view once (only on first mount, not on every nav).
  const initialApplied = useHasAppliedDefault();
  useEffect(() => {
    if (initialApplied) return;
    const def = defaultName;
    if (!def) return;
    const v = views.find((x) => x.name === def);
    if (v && v.query !== sp.toString()) {
      router.replace(v.query ? `${pathname}?${v.query}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, defaultName, initialApplied]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
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
    if (defaultName === n) {
      setDefaultName(null);
      try {
        localStorage.removeItem(DEFAULT_KEY);
      } catch {}
    }
  };

  const setDefault = (n: string) => {
    setDefaultName(n);
    try {
      localStorage.setItem(DEFAULT_KEY, n);
    } catch {}
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs font-semibold text-zinc-500">Saved views:</span>
      {views.length === 0 && <span className="text-xs text-zinc-400">none yet — save the current filters</span>}
      {views.map((v) => {
        const isDefault = defaultName === v.name;
        return (
          <span
            key={v.name}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              isDefault ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
            title={v.query ? `Filters: ${v.query}` : "All leads"}
          >
            <button onClick={() => load(v.query)} className="hover:underline">
              {v.name}
            </button>
            {isDefault && <span className="text-[10px] font-semibold opacity-70">default</span>}
            {!isDefault && (
              <button
                onClick={() => setDefault(v.name)}
                aria-label={`Set ${v.name} as default`}
                className="opacity-50 hover:opacity-100"
              >
                ★
              </button>
            )}
            <button
              onClick={() => remove(v.name)}
              aria-label={`Delete ${v.name}`}
              className={isDefault ? "text-white/70 hover:text-white" : "text-zinc-400 hover:text-red-500"}
            >
              ×
            </button>
          </span>
        );
      })}
      <span className="ml-auto flex items-center gap-1.5">
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
      </span>
    </div>
  );
}

/** Tracks whether the default-view auto-apply already ran this session. */
function useHasAppliedDefault(): boolean {
  const [applied] = useState(() => {
    try {
      return sessionStorage.getItem("marketing.leadViews.applied") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("marketing.leadViews.applied", "1");
    } catch {}
  }, []);
  return applied;
}
