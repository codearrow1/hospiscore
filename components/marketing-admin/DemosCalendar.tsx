"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";
import { DEMO_STATUSES } from "@/lib/marketing/types";
import { StatusBadge } from "@/components/ui/Badge";

export interface DemoCalendarRow {
  id: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  startAt: string;
  durationMin: number;
  status: string;
  assignedTo?: string;
  meetingUrl?: string;
  notes?: string;
  phone?: string;
}

export interface LeadLitePick {
  id: string;
  name: string;
  email: string;
}

const DAY_MS = 86_400_000;
/** Monday-based week start. */
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  return out;
}
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DemosCalendar({
  demos,
  team,
  leads,
  view = "week",
  weekStart,
  page = 1,
}: {
  demos: DemoCalendarRow[];
  team: { id: string; name: string; email: string }[];
  leads: LeadLitePick[];
  /** URL-synced presentation mode. */
  view?: "week" | "list";
  /** ISO date (yyyy-mm-dd) of the Monday the week calendar shows. */
  weekStart?: string;
  /** Past-demos page in list view (10 per page). */
  page?: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Viewer timezone — client only, so it mounts after hydration. */
  const [tz, setTz] = useState("");
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMin = -new Date().getTimezoneOffset();
      const sign = offsetMin >= 0 ? "+" : "-";
      const h = Math.floor(Math.abs(offsetMin) / 60);
      const m = Math.abs(offsetMin) % 60;
      setTz(`${zone} (UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})`);
    } catch {
      setTz("local time");
    }
  }, []);

  const base = "/marketing-admin/demos";
  const navHref = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, ...(weekStart ? { week: weekStart } : {}), ...(page > 1 ? { page: String(page) } : {}), ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (!v || (k === "view" && v === "week") || (k === "page" && v === "1")) continue;
      p.set(k, v);
    }
    return p.toString() ? `${base}?${p}` : base;
  };

  // ---- Week calendar -------------------------------------------------------
  const weekAnchor = useMemo(() => {
    if (weekStart) {
      const parsed = new Date(`${weekStart}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return startOfWeek(parsed);
    }
    return startOfWeek(new Date());
  }, [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekAnchor.getTime() + i * DAY_MS)),
    [weekAnchor],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, DemoCalendarRow[]>();
    for (const d of demos) {
      const key = isoDay(new Date(d.startAt));
      (map.get(key) ?? map.set(key, []).get(key)!).push(d);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    return map;
  }, [demos]);
  const weekDemos = days.reduce((n, d) => n + (byDay.get(isoDay(d))?.length ?? 0), 0);

  // ---- List view -----------------------------------------------------------
  const PER_PAGE = 10;
  const upcoming = useMemo(
    () =>
      demos
        .filter((d) => d.status !== "cancelled" && d.status !== "completed" && d.status !== "no_show")
        .filter((d) => Date.parse(d.startAt) >= Date.now() - DAY_MS)
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    [demos],
  );
  const closed = useMemo(
    () =>
      demos
        .filter((d) => !upcoming.some((u) => u.id === d.id))
        .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt)),
    [demos, upcoming],
  );
  const totalPages = Math.max(1, Math.ceil(closed.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pastPage = closed.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const book = async () => {
    setBusy(true);
    setStatus("");
    if (!form.leadId || !form.startAt) {
      setStatus("Pick a lead and a time.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/marketing/demos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: form.leadId,
        startAt: new Date(form.startAt).toISOString(),
        assignedTo: form.assignedTo || undefined,
        meetingUrl: form.meetingUrl || undefined,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Could not book demo");
      return;
    }
    setShowBook(false);
    setStatus("Demo booked.");
    router.refresh();
  };

  const patchDemo = async (id: string, changes: Record<string, unknown>) => {
    setBusy(true);
    setStatus("");
    const res = await fetch(`/api/marketing/demos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Update failed");
      return;
    }
    setStatus("Demo updated.");
    router.refresh();
  };

  const statusSelect = (d: DemoCalendarRow, compact = false) => (
    <select
      value={d.status}
      disabled={busy}
      onChange={(e) => patchDemo(d.id, { status: e.target.value })}
      className={`rounded-lg border border-zinc-200 bg-white text-xs capitalize text-zinc-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 ${compact ? "px-1.5 py-0.5" : "px-2 py-1"}`}
      aria-label={`Status for demo of ${d.leadName}`}
    >
      {DEMO_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );

  const demoCard = (d: DemoCalendarRow, compact = false) => (
    <div key={d.id} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-bold tabular-nums ${compact ? "text-sm" : "text-lg"}`}>{timeOf(d.startAt)}</p>
          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{d.leadName}</p>
          <p className="truncate text-xs text-zinc-400">
            <a href={`mailto:${d.leadEmail}`} className="hover:underline">{d.leadEmail}</a>
            {d.phone ? ` · ${d.phone}` : ""}
          </p>
        </div>
        {statusSelect(d, compact)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <select
          value={d.assignedTo ?? ""}
          disabled={busy}
          onChange={(e) => patchDemo(d.id, { assignedTo: e.target.value || undefined })}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-600 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          aria-label="Assignee"
        >
          <option value="">Unassigned</option>
          {team.map((t) => (
            <option key={t.id} value={t.email}>{t.name || t.email}</option>
          ))}
        </select>
        <span className="text-zinc-400">{d.durationMin} min</span>
        {d.meetingUrl ? (
          <a href={d.meetingUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Join ↗</a>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">no meeting link</span>
        )}
        <Link href={`/marketing-admin/leads/${d.leadId}`} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          Open lead →
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {status && (
        <p role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {status}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <Link
            href={navHref({ view: "week" })}
            aria-current={view === "week"}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === "week" ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
          >
            Week
          </Link>
          <Link
            href={navHref({ view: "list", page: undefined })}
            aria-current={view === "list"}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === "list" ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
          >
            List
          </Link>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Times shown in your timezone{tz ? <> — <span className="font-medium">{tz}</span></> : null}
        </p>
        <button className={btnPrimary} onClick={() => setShowBook(true)}>
          Book a demo
        </button>
      </div>

      {view === "week" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link href={navHref({ week: isoDay(new Date(weekAnchor.getTime() - 7 * DAY_MS)) })} className={btnGhost} aria-label="Previous week">← Prev</Link>
              <Link href={navHref({ week: undefined })} className={btnGhost}>This week</Link>
              <Link href={navHref({ week: isoDay(new Date(weekAnchor.getTime() + 7 * DAY_MS)) })} className={btnGhost} aria-label="Next week">Next →</Link>
            </div>
            <p className="text-sm font-semibold">
              {dayLabel(days[0])} – {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <span className="ml-2 text-xs font-normal text-zinc-400">{weekDemos} demo{weekDemos === 1 ? "" : "s"}</span>
            </p>
          </div>

          {/* Mobile: day cards stacked. md+: 7-column calendar grid. */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {days.map((d, i) => {
              const items = byDay.get(isoDay(d)) ?? [];
              const isToday = isoDay(d) === isoDay(new Date());
              return (
                <section key={i} className={`min-w-0 rounded-2xl border p-2.5 ${isToday ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
                  <h2 className={`mb-2 flex items-baseline justify-between px-0.5 text-xs font-bold uppercase tracking-wide ${isToday ? "text-indigo-600 dark:text-indigo-300" : "text-zinc-400"}`}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                    <span className="tabular-nums">{d.getDate()}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.length === 0 && (
                      <p className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-[11px] text-zinc-300 dark:border-zinc-800 dark:text-zinc-600">
                        No demos
                      </p>
                    )}
                    {items.map((d) => (
                      <div key={d.id} className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-bold tabular-nums">{timeOf(d.startAt)}</p>
                          <StatusBadge domain="demo" status={d.status} />
                        </div>
                        <Link href={`/marketing-admin/leads/${d.leadId}`} className="mt-0.5 block truncate text-xs font-semibold hover:text-indigo-600 dark:hover:text-indigo-400">
                          {d.leadName}
                        </Link>
                        {d.assignedTo && <p className="truncate text-[10px] text-zinc-400">→ {d.assignedTo.split("@")[0]}</p>}
                        <div className="mt-1 flex items-center gap-1.5">
                          {d.meetingUrl && (
                            <a href={d.meetingUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Join</a>
                          )}
                          {statusSelect(d, true)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Upcoming ({upcoming.length})</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
                Nothing scheduled — book the first demo.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {upcoming.map((d) => (
                  <div key={d.id}>
                    <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{dayLabel(new Date(d.startAt))}</p>
                    {demoCard(d)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Past &amp; closed ({closed.length})</h2>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                    <th className="px-4 py-2.5 font-semibold">When</th>
                    <th className="px-4 py-2.5 font-semibold">Lead</th>
                    <th className="px-4 py-2.5 font-semibold">Assignee</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastPage.map((d) => (
                    <tr key={d.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">
                        {new Date(d.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {timeOf(d.startAt)}
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-2.5">
                        <Link href={`/marketing-admin/leads/${d.leadId}`} className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400">{d.leadName}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500">{d.assignedTo ?? "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge domain="demo" status={d.status} /></td>
                    </tr>
                  ))}
                  {pastPage.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-400">No past demos on this page.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-2 flex items-center justify-end gap-1.5 text-xs">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={navHref({ page: p === 1 ? undefined : String(p) })}
                    aria-current={p === safePage}
                    className={`rounded-lg px-2.5 py-1 font-semibold ${p === safePage ? "bg-indigo-600 text-white" : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"}`}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={showBook} onClose={() => setShowBook(false)} title="Book a demo">
        <div className="space-y-3">
          <Field label="Lead" required>
            <select className={inputCls} value={form.leadId ?? ""} onChange={set("leadId")}>
              <option value="">Select a lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name} — {l.email}</option>
              ))}
            </select>
          </Field>
          <Field label={`Start time${tz ? ` (${tz})` : ""}`} required>
            <input className={inputCls} type="datetime-local" value={form.startAt ?? ""} onChange={set("startAt")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Assignee">
              <select className={inputCls} value={form.assignedTo ?? ""} onChange={set("assignedTo")}>
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.email}>{t.name || t.email}</option>
                ))}
              </select>
            </Field>
            <Field label="Meeting URL">
              <input className={inputCls} value={form.meetingUrl ?? ""} onChange={set("meetingUrl")} placeholder="https://meet…" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputCls} rows={3} value={form.notes ?? ""} onChange={set("notes")} />
          </Field>
          {status && <p className="text-sm text-red-500">{status}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setShowBook(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy} onClick={book}>{busy ? "Booking…" : "Book demo"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
