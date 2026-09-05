"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";
import { DEMO_STATUSES } from "@/lib/marketing/types";

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

function fmt(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export default function DemosCalendar({
  demos,
  team,
  leads,
}: {
  demos: DemoCalendarRow[];
  team: { id: string; name: string; email: string }[];
  leads: LeadLitePick[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const upcoming = useMemo(
    () =>
      demos
        .filter((d) => d.status !== "cancelled" && d.status !== "completed" && d.status !== "no_show")
        .filter((d) => Date.parse(d.startAt) >= Date.now() - 86_400_000)
        .map((d) => ({ ...d, day: fmt(d.startAt).day, time: fmt(d.startAt).time }))
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    [demos],
  );
  const past = [...demos]
    .filter((d) => !upcoming.some((u) => u.id === d.id))
    .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))
    .slice(0, 20);

  const dayGroups = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const d of upcoming) {
      if (!map.has(d.day)) map.set(d.day, []);
      map.get(d.day)!.push(d);
    }
    return Array.from(map.entries());
  }, [upcoming]);

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

  const patch = async (id: string, changes: Record<string, unknown>) => {
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

  const statusSelect = (d: DemoCalendarRow) => (
    <select
      value={d.status}
      disabled={busy}
      onChange={(e) => patch(d.id, { status: e.target.value })}
      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs capitalize text-zinc-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      aria-label={`Status for demo of ${d.leadName}`}
    >
      {DEMO_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5">
      {status && (
        <p role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {status}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {upcoming.length} upcoming · {demos.length - upcoming.length} past/closed
        </p>
        <button className={btnPrimary} onClick={() => setShowBook(true)}>
          Book a demo
        </button>
      </div>

      {dayGroups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
          No demos scheduled yet — book the first one.
        </div>
      )}

      {dayGroups.map(([day, items]) => (
        <section key={day}>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">{day}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((d) => (
              <div key={d.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tabular-nums">{d.time}</p>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{d.leadName}</p>
                    <p className="text-xs text-zinc-400">
                      <a href={`mailto:${d.leadEmail}`} className="hover:underline">{d.leadEmail}</a>
                      {d.phone ? ` · ${d.phone}` : ""}
                    </p>
                  </div>
                  {statusSelect(d)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={d.assignedTo ?? ""}
                    disabled={busy}
                    onChange={(e) => patch(d.id, { assignedTo: e.target.value || undefined })}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-600 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    aria-label="Assignee"
                  >
                    <option value="">Unassigned</option>
                    {team.map((t) => (
                      <option key={t.id} value={t.email}>{t.name || t.email}</option>
                    ))}
                  </select>
                  {d.meetingUrl ? (
                    <a href={d.meetingUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Join ↗</a>
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-600">no meeting link</span>
                  )}
                  <LinkToLead id={d.leadId} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Past & closed</h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Lead</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="px-4 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {new Date(d.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmt(d.startAt).time}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{d.leadName}</td>
                    <td className="px-4 py-2.5 capitalize text-zinc-500">{d.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
          <Field label="Start time (local)" required>
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

function LinkToLead({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/marketing-admin/leads/${id}`)}
      className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
    >
      Open lead →
    </button>
  );
}