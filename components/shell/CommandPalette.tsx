"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { NavItem } from "./types";

interface EntityHit {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

interface LeadHit {
  id: string;
  name?: string;
  email?: string;
  company?: string;
}

/** Quick action surfaced as a palette entry ("Actions" group). */
export interface PaletteAction {
  label: string;
  href: string;
}

/** Stored recents keep their human label so entity deep links read cleanly. */
type RecentEntry = { href: string; label: string };

function readRecents(planeId: string): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(`hs-shell-recent-${planeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Legacy entries were bare href strings.
    return (Array.isArray(parsed) ? parsed : [])
      .map((r: string | RecentEntry) => (typeof r === "string" ? { href: r, label: "" } : r))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function labelForHref(href: string): string {
  const seg = href.split("?")[0].split("#")[0].replace(/\/$/, "").split("/").pop() ?? href;
  return seg.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()) || href;
}

type PaletteEntry =
  | { kind: "recent" | "action"; href: string; label: string }
  | NavItem
  | EntityHit
  | LeadHit;

function entryHref(item: PaletteEntry): string | null {
  if ("href" in item) return item.href;
  if ("email" in item) return `/marketing-admin?lead=${encodeURIComponent(item.id)}`;
  return null;
}

function entryLabel(item: PaletteEntry): string {
  if ("label" in item && typeof item.label === "string") return item.label;
  if ("title" in item) return item.title;
  if ("name" in item || "email" in item) return (item as LeadHit).name || (item as LeadHit).email || "Lead";
  return "";
}

const TYPE_LABEL: Record<string, string> = {
  organization: "Organization",
  property: "Property",
  subscription: "Subscription",
  invoice: "Invoice",
  payment: "Payment",
  lead: "Lead",
  user: "User",
};

/**
 * Unified ⌘K command palette:
 * - workspace navigation always searchable,
 * - optional global entity search (/api/search/global),
 * - optional lead search (/api/marketing/leads?q=).
 * Keyboard: ↑ ↓ navigate · Enter opens · Esc closes.
 */
export function CommandPalette({
  open,
  onClose,
  nav,
  planeId,
  entitySearch = false,
  leadSearch = false,
  actions = [],
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  planeId: string;
  entitySearch?: boolean;
  leadSearch?: boolean;
  /** Quick actions ("+ New Organization" etc.) shown in an Actions group. */
  actions?: PaletteAction[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<EntityHit[]>([]);
  const [leads, setLeads] = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nav.slice(0, 8);
    return nav.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6);
  }, [nav, query]);

  // Actions group: quick actions filtered by the current query.
  const actionMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((a) => !q || a.label.toLowerCase().includes(q));
  }, [actions, query]);

  // Recent group only makes sense on the empty-query landing view.
  const recentItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? [] : recents.slice(0, 4).filter((r) => !nav.some((n) => n.href === r.href));
  }, [recents, query, nav]);

  const showEntityResults = Boolean(entitySearch) && query.trim().length >= 2;
  const showLeadResults = Boolean(leadSearch) && query.trim().length >= 2;

  // Debounced remote search.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2 || (!entitySearch && !leadSearch)) return;
    const seq = ++seqRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        if (entitySearch) {
          const res = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`);
          if (res.ok && seq === seqRef.current) {
            const data = (await res.json()) as { results?: EntityHit[] };
            setEntities(data.results ?? []);
          }
        }
        if (leadSearch) {
          const res = await fetch(`/api/marketing/leads?q=${encodeURIComponent(q)}`);
          if (res.ok && seq === seqRef.current) {
            const data = (await res.json()) as { leads?: LeadHit[] };
            setLeads((data.leads ?? []).slice(0, 5));
          }
        }
      } catch {
        // Network hiccup: palette simply shows no remote hits.
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, entitySearch, leadSearch]);

  // Reset + focus on open; restore focus to the opener on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setEntities([]);
      setLeads([]);
      setActive(0);
      setRecents(readRecents(planeId));
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      restoreRef.current?.focus?.();
      restoreRef.current = null;
    }
  }, [open, planeId]);

  // Keep keyboard focus inside the palette while it is open.
  function onTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    inputRef.current?.focus();
  }

  const flat = useMemo<PaletteEntry[]>(
    () => [
      ...recentItems.map((r) => ({ kind: "recent" as const, href: r.href, label: r.label || labelForHref(r.href) })),
      ...actionMatches.map((a) => ({ kind: "action" as const, href: a.href, label: a.label })),
      ...navMatches,
      ...entities,
      ...leads,
    ],
    [recentItems, actionMatches, navMatches, entities, leads],
  );

  const go = useCallback(
    (item: PaletteEntry) => {
      const href = entryHref(item);
      if (!href) return;
      // Actions are commands, not destinations — don't pollute recents.
      if (!("kind" in item)) {
        try {
          const key = `hs-shell-recent-${planeId}`;
          const entry: RecentEntry = { href, label: entryLabel(item) };
          const next = [entry, ...readRecents(planeId).filter((r) => r.href !== href)].slice(0, 5);
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // storage unavailable — recents are best-effort only
        }
      }
      onClose();
      router.push(href);
    },
    [onClose, planeId, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) go(item);
    }
  }

  // Keep the active row visible while arrowing through long lists.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let index = -1;
  const rowCls =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition";
  const activeCls = "bg-brand-soft text-brand dark:text-indigo-200";

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-black/50 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="border-b border-line p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-autocomplete="list"
            aria-activedescendant={flat.length > 0 ? `cmdk-opt-${active}` : undefined}
            placeholder="Search pages, organizations, subscriptions…"
            aria-label="Search command palette"
            className="w-full rounded-xl border border-zinc-200 bg-surface-subtle px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700"
          />
        </div>
        <div ref={listRef} id="cmdk-list" role="listbox" aria-label="Results" onKeyDown={onTab} className="max-h-[50vh] overflow-y-auto p-2">
          {flat.length === 0 && !searching && (
            <p className="px-3 py-8 text-center text-sm text-zinc-400">
              {query.trim() ? "No matches found." : "Type to search…"}
            </p>
          )}

          {recentItems.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Recent</p>
              {recentItems.map((r) => {
                index += 1;
                const i = index;
                const label = r.label || labelForHref(r.href);
                return (
                  <div
                    key={`recent-${r.href}`}
                    id={`cmdk-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={active === i}
                    tabIndex={-1}
                    onClick={() => go({ kind: "recent", href: r.href, label })}
                    onMouseEnter={() => setActive(i)}
                    className={`${rowCls} ${active === i ? activeCls : ""}`}
                  >
                    <span className="text-zinc-300 dark:text-zinc-600"><ClockIcon /></span>
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </>
          )}

          {actionMatches.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Actions</p>
              {actionMatches.map((a) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={`action-${a.href}`}
                    id={`cmdk-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={active === i}
                    tabIndex={-1}
                    onClick={() => go({ kind: "action", href: a.href, label: a.label })}
                    onMouseEnter={() => setActive(i)}
                    className={`${rowCls} ${active === i ? activeCls : ""}`}
                  >
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-indigo-600 text-[11px] font-black leading-none text-white" aria-hidden="true">+</span>
                    <span className="truncate">{a.label}</span>
                  </div>
                );
              })}
            </>
          )}

          {navMatches.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Go to</p>
              {navMatches.map((n) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={`nav-${n.href}`}
                    id={`cmdk-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={active === i}
                    tabIndex={-1}
                    onClick={() => go(n)}
                    onMouseEnter={() => setActive(i)}
                    className={`${rowCls} ${active === i ? activeCls : ""}`}
                  >
                    <span className="text-zinc-400">{n.icon ?? <NavBullet />}</span>
                    <span className="truncate">{n.label}</span>
                  </div>
                );
              })}
            </>
          )}

          {showEntityResults && entities.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Records</p>
              {entities.map((hit) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={`${hit.type}-${hit.id}`}
                    id={`cmdk-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={active === i}
                    tabIndex={-1}
                    onClick={() => go(hit)}
                    onMouseEnter={() => setActive(i)}
                    className={`${rowCls} ${active === i ? activeCls : ""}`}
                  >
                    <span className="shrink-0 rounded-md border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      {TYPE_LABEL[hit.type] ?? hit.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {hit.title}
                      {hit.subtitle ? <span className="ms-1.5 text-xs text-zinc-400">{hit.subtitle}</span> : null}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {showLeadResults && leads.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Leads</p>
              {leads.map((l) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={`lead-${l.id}`}
                    id={`cmdk-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={active === i}
                    tabIndex={-1}
                    onClick={() => go(l)}
                    onMouseEnter={() => setActive(i)}
                    className={`${rowCls} ${active === i ? activeCls : ""}`}
                  >
                    <span className="shrink-0 rounded-md border border-line bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Lead</span>
                    <span className="min-w-0 flex-1 truncate">
                      {l.name || l.email || l.id}
                      {l.company ? <span className="ms-1.5 text-xs text-zinc-400">{l.company}</span> : null}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {searching && (
            <p className="px-3 py-2 text-xs text-zinc-400" role="status">Searching…</p>
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-zinc-400 sm:flex">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

function NavBullet() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export type { ReactNode };
