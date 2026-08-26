"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ACCOUNT_SETTINGS_NAV } from "@/components/settings/navigation";

interface AccountSettingsLayoutProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  children: ReactNode;
}

export default function AccountSettingsLayout({ children }: AccountSettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar navigation */}
        <nav className="lg:w-48 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1">
            {ACCOUNT_SETTINGS_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
