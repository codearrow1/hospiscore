"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import ScoreSparkline from "@/components/ScoreSparkline";
import { safeNext } from "@/lib/client/safeNext";
import {
  GRADE_COLOR,
  type PublicAuthUser,
  type SavedItem,
} from "@/lib/accountTypes";

export default function SavedList() {
  const router = useRouter();
  const [user, setUser] = useState<PublicAuthUser | null | undefined>(undefined);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [next] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? safeNext(new URLSearchParams(window.location.search).get("next"))
      : null,
  );

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setUser(me.user);
      if (me.user) refreshList();
    })();
  }, []);

  async function refreshList() {
    const res = await fetch("/api/saved").then((r) => r.json());
    setSaved(res.saved ?? []);
  }

  async function handleAuthed(u: PublicAuthUser) {
    setUser(u);
    await refreshList();
    if (next) {
      router.push(next);
    } else if (u.appDashboard && u.appDashboard !== "/account") {
      // Route every role to its canonical dashboard (super admin → /saas,
      // subadmin → /subadmin, portal roles → their portal).
      router.push(u.appDashboard);
    }
  }

  async function remove(slug: string) {
    await fetch(`/api/saved/${slug}`, { method: "DELETE" });
    setSaved((s) => s.filter((x) => x.slug !== slug));
  }

  async function refresh(slug: string) {
    setRefreshing(slug);
    await fetch(`/api/saved/${slug}/refresh`, { method: "POST" });
    setRefreshing(null);
    await refreshList();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSaved([]);
  }

  if (user === undefined) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400" role="status">
        Loading…
      </p>
    );
  }

  if (user === null) {
    return <AuthCard onAuthed={handleAuthed} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Saved properties
          </h2>
          <p className="max-w-full truncate text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as {user.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user.appDashboard && user.appDashboard !== "/account" && (
            <Link
              href={user.appDashboard}
              className="flex min-h-11 items-center rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Go to dashboard
            </Link>
          )}
          {user.isAdmin && (
            <Link
              href="/account/leads"
              className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Sales leads
            </Link>
          )}
          <button
            onClick={logout}
            className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            Sign out
          </button>
        </div>
      </div>

      {saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          You haven&apos;t saved any properties yet. Open any property and click
          &ldquo;Save&rdquo; to track it here.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {saved.map((s) => (
            <li
              key={s.slug}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link href={`/properties/${s.slug}`} className="min-w-0">
                <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                  {s.name}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {s.city}, {s.country}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Score{" "}
                  <span className={`font-bold ${GRADE_COLOR[s.grade]}`}>
                    {s.score}
                  </span>{" "}
                  · {s.history.length} history {s.history.length === 1 ? "point" : "points"}
                </p>
                {s.history.length >= 2 && (
                  <ScoreSparkline points={s.history} />
                )}
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => refresh(s.slug)}
                  disabled={refreshing === s.slug}
                  className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                >
                  {refreshing === s.slug ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  onClick={() => remove(s.slug)}
                  aria-label={`Remove ${s.name}`}
                  className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}