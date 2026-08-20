"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { btnGhost, btnPrimary, EmptyState, Field, inputCls, Modal } from "./ui";
import { STAGE_STYLES } from "@/lib/marketing/stages";
import type { LeadStage } from "@/lib/marketing/types";

export interface LeadRowLite {
  id: string;
  name: string;
  email: string;
  company?: string;
  propertyName?: string;
  country?: string;
  planInterest?: string;
  source: string;
  stage: LeadStage;
  score: number;
  band: string;
  ownerEmail?: string;
  nextFollowUpAt?: string;
  estimatedValue: number;
  rooms?: number;
  createdAt: string;
}

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial);
  const apply = useCallback(
    (value: string) => {
      const p = new URLSearchParams(sp.toString());
      if (value) p.set("q", value);
      else p.delete("q");
      router.push(`/marketing-admin/leads?${p.toString()}`);
    },
    [router, sp],
  );
  useEffect(() => setQ(initial), [initial]);
  return (
    <form
      className="flex min-w-0 flex-1 gap-2 md:max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        apply(q);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email, company, country…"
        className={inputCls}
        aria-label="Search leads"
      />
      <button type="submit" className={btnGhost}>Search</button>
    </form>
  );
}

export function FilterChipLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-8 items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </Link>
  );
}

const STAGE_LIST: LeadStage[] = [
  "new", "qualified", "contacted", "demo_booked", "demo_completed",
  "trial", "proposal", "negotiation", "won", "lost",
];

export function BulkStageBar({
  selected,
  onDone,
}: {
  selected: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<LeadStage>("contacted");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const apply = async () => {
    setBusy(true);
    setMessage("");
    let moved = 0;
    for (const id of selected) {
      const res = await fetch(`/api/marketing/leads/${id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) moved++;
    }
    setBusy(false);
    setMessage(`${moved} moved to ${stage}.`);
    router.refresh();
    setTimeout(onDone, 800);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/40">
      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
        {selected.length} selected {message && `· ${message}`}
      </span>
      <select value={stage} onChange={(e) => setStage(e.target.value as LeadStage)} className={inputCls + " !w-auto"} aria-label="Target stage">
        {STAGE_LIST.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button onClick={apply} disabled={busy} className={btnPrimary}>
        {busy ? "Moving…" : "Move to stage"}
      </button>
    </div>
  );
}

export function RevenueRow({
  lead,
  onSelect,
  selected,
}: {
  lead: LeadRowLite;
  onSelect?: (id: string) => void;
  selected?: boolean;
}) {
  return (
    <tr className="border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40">
      {onSelect && (
        <td className="py-2.5 pl-2 pr-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(lead.id)}
            aria-label={`Select ${lead.name}`}
            className="h-4 w-4 accent-indigo-600"
          />
        </td>
      )}
      <td className="py-2.5 pr-3">
        <Link href={`/marketing-admin/leads/${lead.id}`} className="block font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400">
          {lead.name}
        </Link>
        <span className="block text-xs text-zinc-400">{lead.email}</span>
      </td>
      <td className="py-2.5 pr-3 text-sm text-zinc-600 dark:text-zinc-300">
        {lead.company || lead.propertyName || "—"}
      </td>
      <td className="py-2.5 pr-3 text-sm capitalize text-zinc-600 dark:text-zinc-300">{lead.country || "—"}</td>
      <td className="py-2.5 pr-3 text-sm capitalize text-zinc-600 dark:text-zinc-300">{lead.planInterest || "—"}</td>
      <td className="py-2.5 pr-3 text-sm text-zinc-600 dark:text-zinc-300">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[lead.stage]}`}>
          {lead.stage}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">{lead.rooms ?? ""}</td>
      <td className="py-2.5 text-right text-sm tabular-nums">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">{lead.score}</span>
        <span className="ml-1 text-[10px] uppercase text-zinc-400">{lead.band.replace("_", " ")}</span>
      </td>
    </tr>
  );
}

export function NewLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/marketing/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, company: form.company, country: form.country, source: "direct" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create lead");
      return;
    }
    onCreated(data.lead.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="New lead">
      <div className="space-y-3">
        <Field label="Name" required><input className={inputCls} value={form.name ?? ""} onChange={set("name")} /></Field>
        <Field label="Email" required><input className={inputCls} type="email" value={form.email ?? ""} onChange={set("email")} /></Field>
        <Field label="Phone / WhatsApp"><input className={inputCls} value={form.phone ?? ""} onChange={set("phone")} /></Field>
        <Field label="Company / property"><input className={inputCls} value={form.company ?? ""} onChange={set("company")} /></Field>
        <Field label="Country (2-letter code)"><input className={inputCls} maxLength={2} value={form.country ?? ""} onChange={set("country")} /></Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={submit}>
            {busy ? "Creating…" : "Create lead"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export { EmptyState };