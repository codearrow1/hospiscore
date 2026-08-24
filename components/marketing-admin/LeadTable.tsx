"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { btnGhost, btnPrimary, EmptyState, Field, inputCls, Modal } from "./ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STAGE_STYLES } from "@/lib/marketing/stages";
import { formatMoney } from "@/lib/format";
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
  estimatedValueCurrency?: string;
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

/** URL-synced dropdown filter — merges into the current query string. */
export function SelectFilter({
  param,
  value,
  options,
  label,
  allLabel,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          if (e.target.value) p.set(param, e.target.value);
          else p.delete(param);
          p.delete("page");
          router.push(`${pathname}?${p.toString()}`);
        }}
        className="min-h-8 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="">{allLabel ?? `All ${label.toLowerCase()}`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const STAGE_LIST: LeadStage[] = [
  "new", "qualified", "contacted", "demo_booked", "demo_completed",
  "trial", "proposal", "negotiation", "won", "lost",
];

export function BulkStageBar({
  selected,
  onDone,
  ownerOptions,
}: {
  selected: string[];
  onDone: () => void;
  ownerOptions?: { email: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<LeadStage>("contacted");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmWon, setConfirmWon] = useState(false);

  /** One round-trip per action — authorization and auditing happen server-side
   *  in POST /api/marketing/leads/batch (replaces the old sequential loop). */
  const runBatch = async (
    action: "stage" | "owner" | "delete",
    extra: Record<string, unknown> = {},
    done?: () => void,
  ) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/marketing/leads/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selected, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Batch action failed");
        return;
      }
      setMessage(`${data.done} of ${data.total} updated.`);
      router.refresh();
      setTimeout(onDone, 900);
    } finally {
      setBusy(false);
      done?.();
    }
  };

  const applyStage = () => {
    if (stage === "won") setConfirmWon(true);
    else void runBatch("stage", stage === "lost" ? { stage, lostReason: "other" } : { stage });
  };

  const assignOwner = () => {
    if (!owner) return;
    const isUnassign = owner === "__unassign__";
    void runBatch("owner", { ownerEmail: isUnassign ? "" : owner }, () =>
      setMessage(isUnassign ? "Unassigned." : `Assigned to ${owner}.`),
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/40">
      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
        {selected.length} selected {message && `· ${message}`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select value={stage} onChange={(e) => setStage(e.target.value as LeadStage)} className={inputCls + " !w-auto"} aria-label="Target stage">
          {STAGE_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={applyStage} disabled={busy} className={btnPrimary}>
          {busy ? "Moving…" : "Move stage"}
        </button>
      </div>
      {ownerOptions && ownerOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls + " !w-auto"} aria-label="Assign owner">
            <option value="">Assign to…</option>
            <option value="__unassign__">— Unassign —</option>
            {ownerOptions.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <button onClick={assignOwner} disabled={busy || !owner} className={btnGhost}>
            Assign
          </button>
        </div>
      )}
      <button onClick={() => setConfirmDelete(true)} disabled={busy} className="ml-auto inline-flex min-h-9 items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400">
        Delete
      </button>

      <ConfirmDialog
        action={confirmDelete
          ? {
              title: "Delete leads",
              message: `Delete ${selected.length} selected ${selected.length === 1 ? "lead" : "leads"}?`,
              consequences: [
                "The selected lead records are permanently removed.",
                "Associated activity and notes are deleted with them.",
                "This action cannot be undone.",
              ],
              confirmLabel: `Delete ${selected.length}`,
              tone: "danger",
            }
          : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void runBatch("delete", {}, () => setMessage("Deleted."))}
        busy={busy}
      />

      <ConfirmDialog
        action={confirmWon
          ? {
              title: "Mark leads as won",
              message: `Move ${selected.length} selected ${selected.length === 1 ? "lead" : "leads"} to Won?`,
              consequences: [
                "Won feeds conversion reporting and pipeline value.",
                "Re-opening later is possible but logged.",
                "Every move is recorded in the audit log.",
              ],
              confirmLabel: "Mark won",
            }
          : null}
        onClose={() => setConfirmWon(false)}
        onConfirm={() => void runBatch("stage", { stage: "won" })}
        busy={busy}
      />
    </div>
  );
}

function fmtFollowUp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days < -1) return `${label} · overdue`;
  if (days <= 1) return `${label} · due`;
  return label;
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
  const stageBadge = (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[lead.stage]}`}>
      {lead.stage.replace(/_/g, " ")}
    </span>
  );
  const followUp = fmtFollowUp(lead.nextFollowUpAt);
  return (
    <>
      {/* Desktop / tablet row */}
      <tr className="hidden border-b border-zinc-100 transition hover:bg-zinc-50 md:table-row dark:border-zinc-800/70 dark:hover:bg-zinc-800/40">
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
        <td className="py-2.5 pr-3 text-sm text-zinc-600 dark:text-zinc-300">{stageBadge}</td>
        <td className="py-2.5 pr-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">{lead.rooms ?? ""}</td>
        <td className="py-2.5 pr-3 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatMoney(lead.estimatedValue, lead.estimatedValueCurrency ?? "USD")}
        </td>
        <td className={`py-2.5 pr-3 text-xs tabular-nums ${followUp.includes("overdue") ? "font-semibold text-red-600 dark:text-red-400" : followUp.includes("due") ? "font-semibold text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>
          {followUp || "—"}
        </td>
        <td className="max-w-[10rem] truncate py-2.5 pr-3 text-xs text-zinc-500" title={lead.ownerEmail}>
          {lead.ownerEmail ?? <span className="text-zinc-300 dark:text-zinc-600">unassigned</span>}
        </td>
        <td className="py-2.5 text-right text-sm tabular-nums">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{lead.score}</span>
          <span className="ml-1 text-[10px] uppercase text-zinc-400">{lead.band.replace("_", " ")}</span>
        </td>
      </tr>

      {/* Mobile card */}
      <tr className="border-b border-zinc-100 md:hidden dark:border-zinc-800/70">
        <td colSpan={onSelect ? 11 : 10} className="px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {onSelect && (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onSelect(lead.id)}
                  aria-label={`Select ${lead.name}`}
                  className="mr-2 h-4 w-4 align-middle accent-indigo-600"
                />
              )}
              <Link href={`/marketing-admin/leads/${lead.id}`} className="align-middle font-semibold text-zinc-900 dark:text-zinc-50">
                {lead.name}
              </Link>
              <p className="mt-0.5 truncate text-xs text-zinc-400">{lead.email}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                {stageBadge}
                {lead.country && <span>{lead.country}</span>}
                {lead.planInterest && <span>· {lead.planInterest}</span>}
              </p>
              <p className="mt-1 text-xs tabular-nums text-zinc-500">
                {formatMoney(lead.estimatedValue, lead.estimatedValueCurrency ?? "USD")}
                {followUp && <span className={`ml-2 ${followUp.includes("overdue") || followUp.includes("due") ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>↻ {followUp}</span>}
              </p>
              {lead.ownerEmail && <p className="mt-0.5 truncate text-[11px] text-zinc-400">→ {lead.ownerEmail}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{lead.score}</p>
              <p className="text-[10px] uppercase text-zinc-400">{lead.band.replace("_", " ")}</p>
            </div>
          </div>
        </td>
      </tr>
    </>
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