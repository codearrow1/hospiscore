"use client";

import { useMemo, useState } from "react";
import { AccessibleModal, Field, Select, inputCls } from "@/components/ui/index";
import { buttonClass } from "@/components/ui/Button";
import { conflictsFor, DEFAULT_SLOT_MINUTES, type DemoRow } from "@/lib/marketing/demosView";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { timeOf } from "./demoUi";

export function BookDemoModal({
  open,
  onClose,
  team,
  leads,
  conflictRows,
  tzLabel,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  team: { id: string; name: string; email: string }[];
  leads: { id: string; name: string; email: string }[];
  conflictRows: DemoRow[];
  tzLabel: string;
  onBooked: () => void;
}) {
  const empty = {
    leadId: "",
    startAt: "",
    durationMin: String(DEFAULT_SLOT_MINUTES),
    demoType: "",
    assignedTo: "",
    meetingUrl: "",
    phone: "",
    notes: "",
  };
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const demoTypes = useMemo(() => Array.from(new Set(conflictRows.map((r) => r.demoType).filter(Boolean) as string[])), [conflictRows]);

  const conflicts = useMemo(() => {
    if (!form.startAt || Date.parse(form.startAt) < 0) return [];
    return conflictsFor(conflictRows, {
      assignedTo: form.assignedTo || undefined,
      startAt: new Date(form.startAt).toISOString(),
      durationMin: parseInt(form.durationMin, 10) || DEFAULT_SLOT_MINUTES,
    }).slice(0, 4);
  }, [conflictRows, form.startAt, form.assignedTo, form.durationMin]);

  const book = async () => {
    setBusy(true);
    setError("");
    if (!form.leadId || !form.startAt) {
      setError("Pick a lead and a start time.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/marketing/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: form.leadId,
          startAt: new Date(form.startAt).toISOString(),
          durationMin: parseInt(form.durationMin, 10) || DEFAULT_SLOT_MINUTES,
          demoType: form.demoType || undefined,
          assignedTo: form.assignedTo || undefined,
          meetingUrl: form.meetingUrl || undefined,
          phone: form.phone || undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not book demo");
        setBusy(false);
        return;
      }
      setForm(empty);
      setBusy(false);
      onBooked();
    } catch {
      setError("Could not book demo");
      setBusy(false);
    }
  };

  return (
    <AccessibleModal open={open} onClose={() => { if (!busy) onClose(); }} title="Book a demo">
      <div className="space-y-3">
        <Field label="Lead" required>
          <SearchableSelect
            options={leads.map((l) => ({ value: l.id, label: `${l.name} — ${l.email}` }))}
            value={form.leadId || null}
            onChange={(v) => setForm((f) => ({ ...f, leadId: v }))}
            placeholder="Search leads…"
            searchPlaceholder="Type to search leads…"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Start time${tzLabel ? ` (${tzLabel})` : ""}`} required>
            <input className={inputCls} type="datetime-local" value={form.startAt} onChange={set("startAt")} />
          </Field>
          <Field label="Duration">
            <Select value={form.durationMin} onChange={set("durationMin")} className="w-full">
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </Select>
          </Field>
          <Field label="Demo type">
            <input
              className={inputCls}
              list="demo-types"
              value={form.demoType}
              onChange={set("demoType")}
              placeholder="e.g. Product walkthrough"
            />
            <datalist id="demo-types">
              {demoTypes.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="Assignee">
            <Select value={form.assignedTo} onChange={set("assignedTo")} className="w-full">
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.id} value={t.email}>{t.name || t.email}</option>
              ))}
            </Select>
          </Field>
          <Field label="Meeting URL">
            <input className={inputCls} value={form.meetingUrl} onChange={set("meetingUrl")} placeholder="https://meet…" />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="+…" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputCls} rows={3} value={form.notes} onChange={set("notes")} placeholder="Agenda, prep notes…" />
        </Field>

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="font-bold">Possible double-booking</p>
            <ul className="mt-1 space-y-0.5">
              {conflicts.map((c) => (
                <li key={c.id}>• {c.leadName} at {timeOf(c.startAt)} ({c.assignedTo?.split("@")[0] || "unassigned"})</li>
              ))}
            </ul>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={buttonClass("secondary")} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={buttonClass("primary")} onClick={book} disabled={busy}>
            {busy ? "Booking…" : "Book demo"}
          </button>
        </div>
      </div>
    </AccessibleModal>
  );
}