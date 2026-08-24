"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { CommandPalette } from "./CommandPalette";
import type { NavItem, PlaneInfo, QuickAction, ShellUser } from "./types";

/**
 * HospiOS unified application shell (Phase 1).
 * Replaces AdminShell + per-plane chrome with one plane-aware layout:
 * collapsible rail (persisted per plane), mobile drawer, topbar with quick
 * actions / help / notifications placeholder / user menu, and a single ⌘K
 * command palette. Business logic is untouched — this is presentation only.
 */
export function AppShell({
  plane,
  user,
  nav,
  quickActions = [],
  entitySearch = false,
  leadSearch = false,
  children,
}: {
  plane: PlaneInfo;
  user: ShellUser;
  nav: NavItem[];
  quickActions?: QuickAction[];
  entitySearch?: boolean;
  leadSearch?: boolean;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <ShellFrame
        plane={plane}
        user={user}
        nav={nav}
        quickActions={quickActions}
        entitySearch={entitySearch}
        leadSearch={leadSearch}
      >
        {children}
      </ShellFrame>
    </ToastProvider>
  );
}

function ShellFrame({
  plane,
  user,
  nav,
  quickActions = [],
  entitySearch,
  leadSearch,
  children,
}: {
  plane: PlaneInfo;
  user: ShellUser;
  nav: NavItem[];
  quickActions?: QuickAction[] | undefined;
  entitySearch: boolean;
  leadSearch: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Restore per-plane rail preference.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`hs-shell-rail-${plane.id}`);
      if (saved !== null) setRailCollapsed(saved === "1");
    } catch {
      // storage unavailable
    }
  }, [plane.id]);

  function toggleRail() {
    setRailCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(`hs-shell-rail-${plane.id}`, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Global ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close user menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/account");
    } catch {
      toast.error("Could not sign out. Please retry.");
      setSigningOut(false);
    }
  }

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const navList = (
    <nav aria-label={`${plane.name} navigation`} className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
      {nav.map((item) =>
        railCollapsed ? (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-h-9 items-center justify-center rounded-xl text-sm font-medium transition ${
              isActive(item.href)
                ? "bg-brand-soft text-brand dark:text-indigo-200"
                : "text-zinc-500 hover:bg-surface-subtle hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {item.icon ?? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
          </Link>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition ${
              isActive(item.href)
                ? "bg-brand-soft font-semibold text-brand dark:text-indigo-200"
                : "text-zinc-600 hover:bg-surface-subtle hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <span className="grid w-5 shrink-0 place-items-center text-base leading-none">
              {item.icon ?? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );

  const brand = (
    <div className={`flex h-14 shrink-0 items-center border-b border-line ${railCollapsed ? "justify-center px-2" : "gap-2 px-4"}`}>
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-600 text-xs font-black text-white">
        H
      </span>
      {!railCollapsed && (
        <span className="min-w-0 truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{plane.name}</span>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas text-zinc-900 dark:text-zinc-100">
      {/* Desktop rail */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] md:flex ${
          railCollapsed ? "w-[64px]" : "w-60"
        }`}
      >
        {brand}
        {navList}
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={toggleRail}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-surface-subtle hover:text-zinc-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {railCollapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
            </svg>
            {!railCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[58] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="relative flex h-full w-72 max-w-[80vw] flex-col border-r border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pr-2">
              {brand}
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-zinc-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {navList}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-zinc-500 hover:bg-surface-subtle md:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex min-h-8 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:border-indigo-300 sm:max-w-md"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="flex-1 truncate">Search…</span>
            <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] sm:block">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {quickActions.slice(0, 2).map((qa) => (
              <Link
                key={qa.href}
                href={qa.href}
                className="hidden min-h-8 items-center rounded-lg border border-line px-2.5 text-xs font-semibold text-zinc-600 transition hover:bg-surface-subtle lg:inline-flex dark:text-zinc-300"
              >
                {qa.label}
              </Link>
            ))}

            <button
              type="button"
              aria-label="Notifications (not available yet)"
              title="Notifications coming soon"
              onClick={() => toast.info("Notifications are coming soon.")}
              className="relative rounded-lg p-2 text-zinc-400 transition hover:bg-surface-subtle hover:text-zinc-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>

            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              aria-label="Help and documentation"
              className="hidden rounded-lg p-2 text-zinc-400 transition hover:bg-surface-subtle hover:text-zinc-600 sm:block"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01" />
              </svg>
            </a>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex min-h-8 items-center gap-2 rounded-full border border-line pl-1 pr-2.5 transition hover:bg-surface-subtle"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-[10px] font-bold uppercase text-white">
                  {(user.name || user.email).slice(0, 1)}
                </span>
                <span className="hidden max-w-[120px] truncate text-xs font-semibold sm:block">
                  {user.name || user.email}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
                >
                  <div className="border-b border-line px-3.5 py-3">
                    <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                    <p className="truncate text-xs text-zinc-400">{user.email}</p>
                    <p className="mt-1 inline-flex rounded-md bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      {user.roleLabel}
                    </p>
                  </div>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-6" tabIndex={-1}>
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        nav={nav}
        planeId={plane.id}
        entitySearch={entitySearch}
        leadSearch={leadSearch}
      />
    </div>
  );
}
