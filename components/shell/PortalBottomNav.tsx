"use client";

/**
 * PortalBottomNav — thumb-reachable bottom navigation for role portals.
 * Rendered inside AppShell (md:hidden) so portal sections stay one tap away
 * on phones. Active state follows the pathname; hash links scroll natively.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BottomNavItem {
  href: string;
  label: string;
}

function initial(label: string): string {
  const clean = label.replace(/[^\p{L}\p{N}]/gu, "");
  return (clean.slice(0, 1) || "•").toUpperCase();
}

export default function PortalBottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();
  const shown = items.slice(0, 5);
  return (
    <nav
      aria-label="Portal sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-xl items-stretch">
        {shown.map((item) => {
          const base = item.href.split("#")[0];
          const active = pathname === base || pathname.startsWith(`${base}/`);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition ${
                  active
                    ? "text-brand dark:text-indigo-300"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black ${
                    active ? "bg-brand-soft text-brand dark:text-indigo-200" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {initial(item.label)}
                </span>
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
