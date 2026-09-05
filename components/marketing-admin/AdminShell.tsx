"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

export interface AdminUserInfo {
  name: string;
  email: string;
  roleLabel: string | null;
}

const ICONS: Record<string, ReactNode> = {
  dashboard: <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />,
  leads: <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2v-1h18v1h2V10c0-1.1-.9-2-2-2ZM3 6h12v11H3V6Zm14 11V10h3v7h-3ZM7 12h4v1.5H7V12Z" />,
  pipeline: <path d="M4 5h6v14H4V5Zm10 3h6v11h-6V8Zm-5 3H8v5h1v-5Zm5 0h-2v8h2v-8Z" />,
  demos: <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10ZM5 8V6h14v2H5Zm3 5h8v1.5H8V13Zm0 3.5h8V18H8v-1.5Z" />,
  campaigns: <path d="M3 17l6-6-2-4 5-5 3 6 5-3.5v11H5l3-6-2.5 3.5L3 17Zm12 2h6v2h-6v-2Z" opacity={0.6} />,
  forms: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-6 18V4h7v5h5v11H8Zm7-13h3.6L14 4.4V7h1Zm-5 3h6v1.5h-6V10Zm0 3h6v1.5h-6V13Zm0 3h4v1.5h-4V16Z" />,
  pricing: <path d="M3 5h18v4l-2-1v9H5v-9L3 9V5Zm4 10h2v-3H7v3Zm4 0h2v-5h-2v5Zm4 0h2v-5h-2v5Z" />,
  analytics: <path d="M5 20h14v2H5v-2Zm2-3h3v-6H7v6Zm5 0h3V8h-3v9Zm5 0h3v-4h-3v4ZM5 9h4V4H5v5Z" />,
  audit: <path d="M12 2 4 5v6c0 5.05 3.41 9.76 8 10 4.59-.24 8-4.95 8-10V5l-8-3Zm0 2.1 6 2.25V11c0 4.16-2.65 8.04-6 8.85-3.35-.81-6-4.69-6-8.85V6.35L12 4.1ZM11 7h2v7h-2V7Zm0 8.5h2V18h-2v-2.5Z" />,
  settings: <path d="M19.14 12.94a7.5 7.5 0 0 0 .05-.94 7.5 7.5 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.95L14.5 2.6a.5.5 0 0 0-.5-.41h-3.84a.5.5 0 0 0-.5.41l-.29 2.44a7.3 7.3 0 0 0-1.62.95l-2.39-.96a.5.5 0 0 0-.61.22l-1.92 3.32a.5.5 0 0 0 .12.64l2.03 1.58a7.5 7.5 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.39.32.61.22l2.39-.96c.5.4 1.06.72 1.63.95l.29 2.44c.05.23.26.41.5.41h3.84c.24 0 .46-.18.5-.41l.29-2.44a7.3 7.3 0 0 0 1.63-.95l2.39.96c.22.1.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />,
};

function PaletteGlyph() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 6A6 6 0 1 0 12.9 15.2 4.5 4.5 0 1 0 15 8.2 6 6 0 0 0 9 6Zm8.5 13 3 3" />
    </svg>
  );
}

function QuickActions({ onAction }: { onAction: () => void }) {
  const actions = [
    { href: "/marketing-admin/leads?new=1", label: "New lead" },
    { href: "/marketing-admin/demos?new=1", label: "Book demo" },
    { href: "/marketing-admin/campaigns?new=1", label: "Create campaign" },
    { href: "/marketing-admin/pricing", label: "Edit pricing" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          onClick={onAction}
          className="inline-flex min-h-8 items-center rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-indigo-400"
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}

function CommandPalette({
  open,
  onClose,
  nav,
}: {
  open: boolean;
  onClose: () => void;
  nav: AdminNavItem[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<{ id: string; name: string; email: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setLeads([]);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setLeads([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/marketing/leads?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { leads: [] }))
        .then((d) => setLeads((d.leads ?? []).slice(0, 6)))
        .catch(() => setLeads([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  const pages = nav.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()));
  const jump = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 pt-[12vh]" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <PaletteGlyph />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages and leads…"
            className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />
          <kbd className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {pages.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Pages</p>
              {pages.map((n) => (
                <button
                  key={n.href}
                  onClick={() => jump(n.href)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {ICONS[n.icon]}
                  </svg>
                  {n.label}
                </button>
              ))}
            </div>
          )}
          {leads.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Leads</p>
              {leads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => jump(`/marketing-admin/leads/${l.id}`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="block truncate text-xs text-zinc-400">{l.email}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {pages.length === 0 && leads.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-zinc-400">No matches for “{q}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({
  user,
  nav,
  children,
}: {
  user: AdminUserInfo;
  nav: AdminNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  useEffect(() => {
    const saved = localStorage.getItem("hs-admin-collapsed");
    if (saved) setCollapsed(saved === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("hs-admin-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    setPalette(false);
  }, [pathname]);

  const bar = useMemo(() => (collapsed ? "w-14" : "w-60"), [collapsed]);

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 md:flex dark:border-zinc-800 dark:bg-zinc-900 ${bar}`}>
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
          <Link href="/marketing-admin" className={`flex min-w-0 items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-600 text-sm font-black text-white">H</span>
            {!collapsed && (
              <span className="truncate text-sm font-bold">
                HospiOS <span className="text-indigo-600 dark:text-indigo-400">Marketing</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`ml-auto rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${collapsed ? "hidden" : ""}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {!collapsed && (
            <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Marketing</p>
          )}
          {nav.map((n) => {
            const active = pathname === n.href || (n.href !== "/marketing-admin" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}
              >
                <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  {ICONS[n.icon]}
                </svg>
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={`border-t border-zinc-200 p-3 dark:border-zinc-800 ${collapsed ? "text-center" : ""}`}>
          <p className="truncate text-xs font-semibold">{user.name}</p>
          {!collapsed && (
            <>
              <p className="truncate text-[11px] text-zinc-400">{user.email}</p>
              {user.roleLabel && (
                <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {user.roleLabel}
                </span>
              )}
              <button
                onClick={logout}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <Link href="/marketing-admin" className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-600 text-sm font-black text-white md:hidden">
            H
          </Link>
          <button
            onClick={() => setPalette(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-400 transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 md:max-w-md"
          >
            <PaletteGlyph />
            <span className="truncate">Search leads, pages…</span>
            <kbd className="ml-auto hidden rounded-md border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-400 md:block dark:border-zinc-600">
              Ctrl K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <QuickActions onAction={() => setPalette(false)} />
            <span className="hidden text-xs text-zinc-400 sm:block">{pathname}</span>
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
              </svg>
            </button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
          HospiOS Marketing Command Center · data from the website pipeline
        </footer>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} nav={nav} />
    </div>
  );
}