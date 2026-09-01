"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STAGE_STYLES, PRIORITY_LABELS, PRIORITY_STYLES } from "@/lib/marketing/stages";
import { formatMoney, formatRelative } from "@/lib/format";
import type { LeadStage } from "@/lib/marketing/types";

/** Serializable row shape passed from the server (all derived w/ real data). */
export interface LeadRowLite {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  propertyName?: string;
  propertyType?: string;
  city?: string;
  country?: string;
  rooms?: number;
  currentPms?: string;
  planInterest?: string;
  source: string;
  stage: LeadStage;
  score: number;
  band: string;
  priority?: "high" | "medium" | "low";
  ownerEmail?: string;
  nextFollowUpAt?: string;
  estimatedValue: number;
  estimatedValueCurrency?: string;
  createdAt: string;
  // Derived (real signals from leadsView)
  dealAgeDays: number;
  daysInStage: number;
  stale: boolean;
  followUpStatus: "none" | "overdue" | "due" | "later";
  demoStatus: "none" | "scheduled" | "completed" | "no_show" | "cancelled";
  converted: boolean;
  quality: {
    missingEmail: boolean;
    missingPhone: boolean;
    missingProperty: boolean;
    missingSource: boolean;
    unassigned: boolean;
    noNextStep: boolean;
    incomplete: boolean;
  };
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
      p.delete("page");
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
        placeholder="Search name, email, property, country…"
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
  onRemove,
}: {
  href: string;
  label: string;
  active: boolean;
  onRemove?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      <Link href={href} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
        {label}
      </Link>
      {active && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove filter ${label}`}
          className="grid h-4 w-4 place-items-center rounded-full text-white hover:bg-white/20"
        >
          ×
        </button>
      )}
    </div>
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
              {s.replace(/_/g, " ")}
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

export function fmtFollowUp(iso?: string): { text: string; tone: "overdue" | "due" | "later" | "none" } {
  if (!iso) return { text: "", tone: "none" };
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days < 0) return { text: `${label} · overdue (${formatRelative(iso)})`, tone: "overdue" };
  if (days <= 1) return { text: `${label} · due`, tone: "due" };
  return { text: label, tone: "later" };
}

const DEMO_LABEL: Record<LeadRowLite["demoStatus"], { text: string; cls: string }> = {
  none: { text: "", cls: "" },
  scheduled: { text: "demo", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  completed: { text: "demo done", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  no_show: { text: "no-show", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  cancelled: { text: "cancelled", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function QualityBadges({ lead }: { lead: LeadRowLite }) {
  return (
    <span className="inline-flex items-center gap-1">
      {lead.quality.missingEmail && (
        <span title="Missing email" className="rounded bg-red-100 px-1 text-[10px] font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-300">no email</span>
      )}
      {lead.quality.missingProperty && (
        <span title="Missing property/company" className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">no property</span>
      )}
      {lead.quality.unassigned && !lead.converted && (
        <span title="Unassigned" className="rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">unassigned</span>
      )}
      {lead.stale && (
        <span title="No activity in 14+ days" className="rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">stale</span>
      )}
      {lead.converted && (
        <span className="rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">won</span>
      )}
    </span>
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
  const stageBadge = (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[lead.stage]}`}>
      {lead.stage.replace(/_/g, " ")}
    </span>
  );
  const followUp = fmtFollowUp(lead.nextFollowUpAt);
  const demo = DEMO_LABEL[lead.demoStatus];
  const primary = lead.propertyName ?? lead.company ?? lead.name;
  const secondary = lead.propertyName && lead.company ? lead.company : lead.email;

  return (
    <>
      {/* Desktop / tablet row — property-first hierarchy */}
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
          <Link href={`/marketing-admin/leads/${lead.id}`} className="block max-w-[16rem] truncate font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400">
            {primary}
          </Link>
          <span className="block max-w-[16rem] truncate text-xs text-zinc-400">{secondary}</span>
          {lead.converted && lead.demoStatus !== "none" && (
            <span className="mt-0.5 flex items-center gap-1"><QualityBadges lead={lead} /></span>
          )}
        </td>
        <td className="py-2.5 pr-3 text-sm text-zinc-600 dark:text-zinc-300">
          <span className="flex flex-wrap items-center gap-1">
            {stageBadge}
            {demo.text && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${demo.cls}`}>{demo.text}</span>}
          </span>
          {lead.priority && (
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[lead.priority]}`}>
              {PRIORITY_LABELS[lead.priority]}
            </span>
          )}
        </td>
        <td className="py-2.5 pr-3 text-sm capitalize text-zinc-600 dark:text-zinc-300">{lead.country || "—"}</td>
        <td className="py-2.5 pr-3 text-sm capitalize text-zinc-600 dark:text-zinc-300">{lead.planInterest || "—"}</td>
        <td className="py-2.5 pr-3 text-sm text-zinc-600 dark:text-zinc-300">{lead.source.replace(/_/g, " ")}</td>
        <td className="py-2.5 pr-3 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatMoney(lead.estimatedValue, lead.estimatedValueCurrency ?? "USD")}
        </td>
        <td className={`py-2.5 pr-3 text-xs tabular-nums ${followUp.tone === "overdue" ? "font-semibold text-red-600 dark:text-red-400" : followUp.tone === "due" ? "font-semibold text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>
          {followUp.text || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
        </td>
        <td className="max-w-[10rem] truncate py-2.5 pr-3 text-xs text-zinc-500" title={lead.ownerEmail}>
          {lead.ownerEmail ?? <span className="text-zinc-300 dark:text-zinc-600">unassigned</span>}
        </td>
        <td className="py-2.5 text-right text-sm tabular-nums">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{lead.score}</span>
          <span className="ml-1 text-[10px] uppercase text-zinc-400">{lead.band.replace(/_/g, " ")}</span>
        </td>
      </tr>

      {/* Mobile card */}
      <tr className="border-b border-zinc-100 md:hidden dark:border-zinc-800/70">
        <td colSpan={onSelect ? 10 : 9} className="px-3 py-3">
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
                {primary}
              </Link>
              <p className="mt-0.5 truncate text-xs text-zinc-400">{secondary}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                {stageBadge}
                <QualityBadges lead={lead} />
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                {lead.country && <span className="capitalize">{lead.country}</span>}
                {lead.source && <span>· {lead.source.replace(/_/g, " ")}</span>}
                {lead.planInterest && <span>· {lead.planInterest}</span>}
              </p>
              <p className="mt-1 text-xs tabular-nums text-zinc-500">
                {formatMoney(lead.estimatedValue, lead.estimatedValueCurrency ?? "USD")}
                {followUp.text && (
                  <span className={`ml-2 ${followUp.tone === "overdue" || followUp.tone === "due" ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>
                    ↻ {followUp.text}
                  </span>
                )}
              </p>
              {lead.ownerEmail && <p className="mt-0.5 truncate text-[11px] text-zinc-400">→ {lead.ownerEmail}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{lead.score}</p>
              <p className="text-[10px] uppercase text-zinc-400">{lead.band.replace(/_/g, " ")}</p>
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
      body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, company: form.company, propertyName: form.propertyName, country: form.country, source: "direct" }),
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
        <Field label="Property name"><input className={inputCls} value={form.propertyName ?? ""} onChange={set("propertyName")} /></Field>
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

export { EmptyState } from "./ui";
