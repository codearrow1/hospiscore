"use client";

/** Pipeline dialogs — create / import / follow-up / assign-owner. */

import { useEffect, useRef, useState } from "react";
import { AccessibleModal } from "@/components/ui/AccessibleModal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, inputCls } from "@/components/ui/Field";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/marketing/stages";
import { formatDateTime } from "@/lib/format";
import type { PipelineDeal } from "@/lib/marketing/pipeline";

const PLAN_OPTIONS = ["solopreneur", "starter", "growth", "professional", "enterprise"];
const SOURCE_OPTIONS = [
  "organic",
  "google_ads",
  "meta_ads",
  "linkedin",
  "youtube",
  "direct",
  "referral",
  "partner",
  "email",
  "whatsapp",
  "blog",
  "pricing_page",
  "feature_page",
  "demo_page",
  "country_page",
  "campaign",
  "other",
];

/* ------------------------------------------------------------ Follow-up */

export function FollowUpDialog({
  deal,
  onClose,
  onSubmit,
  busy = false,
}: {
  deal: PipelineDeal;
  onClose: () => void;
  onSubmit: (atIso: string | "clear") => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState(() => {
    const iso = deal.nextFollowUpAt;
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  return (
    <AccessibleModal open onClose={onClose} title="Follow-up" dismissOnBackdrop={!busy}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Schedule the next touchpoint for <span className="font-semibold">{deal.name}</span>.
      </p>
      <div className="mt-3">
        <Field label="Date and time">
          <input
            className={inputCls}
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </div>
      {deal.nextFollowUpAt && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Current: {formatDateTime(deal.nextFollowUpAt)}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {deal.nextFollowUpAt && (
          <>
            <Button variant="ghost" onClick={() => onSubmit("clear")} disabled={busy}>
              Clear
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!value) return;
            onSubmit(new Date(value).toISOString());
          }}
          disabled={busy || !value}
          loading={busy}
          loadingLabel="Saving…"
        >
          Save
        </Button>
      </div>
    </AccessibleModal>
  );
}

/* ------------------------------------------------------- Assign owner */

export function AssignOwnerDialog({
  deal,
  options,
  onClose,
  onSubmit,
  busy = false,
}: {
  deal: PipelineDeal;
  options: { email: string; name: string }[];
  onClose: () => void;
  onSubmit: (ownerEmail: string) => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState(deal.ownerEmail ?? "");
  return (
    <AccessibleModal open onClose={onClose} title="Assign owner" dismissOnBackdrop={!busy}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Ownership is recorded on the timeline and filters by owner immediately.
      </p>
      <div className="mt-3">
        <Field label="Salesperson">
          <Select value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Unassigned</option>
            {options.map((o) => (
              <option key={o.email} value={o.email}>
                {o.name} ({o.email})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(value)}
          disabled={busy || value === (deal.ownerEmail ?? "")}
          loading={busy}
          loadingLabel="Saving…"
        >
          Assign
        </Button>
      </div>
    </AccessibleModal>
  );
}

/* ------------------------------------------------------------ New deal */

export function NewDealModal({
  open,
  onClose,
  onCreated,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  busy?: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const submit = async () => {
    setError("");
    if (!form.name?.trim() && !form.email?.trim() && !form.phone?.trim()) {
      setError("A name, email or phone is required.");
      return;
    }
    setError("");
    const res = await fetch("/api/marketing/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        propertyName: form.propertyName,
        country: form.country,
        rooms: form.rooms ? Number(form.rooms) : undefined,
        planInterest: form.planInterest || undefined,
        billingCycle: form.billingCycle || undefined,
        source: form.source || "direct",
        priority: form.priority || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create deal");
      return;
    }
    onCreated();
  };

  return (
    <AccessibleModal open={open} onClose={onClose} title="New deal">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Phone / WhatsApp">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Country (2-letter code)">
            <Input maxLength={2} value={form.country ?? ""} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </Field>
          <Field label="Company">
            <Input value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </Field>
          <Field label="Rooms">
            <Input type="number" min={1} value={form.rooms ?? ""} onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))} />
          </Field>
          <Field label="Plan interest">
            <Select value={form.planInterest ?? ""} onChange={(e) => setForm((f) => ({ ...f, planInterest: e.target.value }))}>
              <option value="">—</option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing cycle">
            <Select value={form.billingCycle ?? ""} onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}>
              <option value="">—</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <Field label="Source">
            <Select value={form.source ?? "direct"} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority ?? ""} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              <option value="">Not set</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Property name">
          <Input value={form.propertyName ?? ""} onChange={(e) => setForm((f) => ({ ...f, propertyName: e.target.value }))} />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy} loading={busy} loadingLabel="Creating…">
            Create deal
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}

/* ------------------------------------------------------------- Import */

export interface ImportResult {
  created: number;
  duplicates: number;
  failed: number;
  errors?: string[];
}

export function ImportLeadsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCsv("");
      setError("");
      setResult(null);
    }
  }, [open]);

  const readFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (text.length > 500_000) {
        setError("File is too large (max 500 KB).");
        return;
      }
      setCsv(text);
    };
    reader.readAsText(f);
  };

  const submit = async () => {
    if (!csv.trim()) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/marketing/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(data as ImportResult);
      onImported(data as ImportResult);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccessibleModal open={open} onClose={onClose} title="Import deals (CSV)" wide>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Paste rows exported from <span className="font-mono">Leads → Export</span>, or upload a compatible file.
          Headers like <span className="font-mono">name, email, phone, company, country, rooms, planInterest
          (or plan), source, priority, stage, estimatedValue</span> are recognized. Matching contacts are merged,
          never duplicated.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => readFile(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Choose file…
          </Button>
          {csv && <span className="text-xs text-zinc-500">{csv.length.toLocaleString()} characters loaded</span>}
        </div>
        <Field label="CSV content">
          <textarea
            className={inputCls + " min-h-40 font-mono text-xs"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'name,email,country,rooms,source\nHotel Rama,hello@rama.example,IN,40,direct'}
          />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {result.created} created · {result.duplicates} matched existing · {result.failed} failed
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-[11px]">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !csv.trim().length} loading={busy} loadingLabel="Importing…">
            Import {csv.trim().split("\n").filter(Boolean).length > 1 ? `${csv.trim().split("\n").length - 1} rows` : ""}
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}