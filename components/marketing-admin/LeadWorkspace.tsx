"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, btnGhost, btnPrimary, EmptyState, Field, inputCls, Modal, SectionCard } from "./ui";
import { STAGE_LABELS, STAGE_STYLES } from "@/lib/marketing/stages";
import { formatMoney } from "@/lib/format";
import type { LostReason } from "@/lib/marketing/stages";
import type { LeadEventType } from "@/lib/marketing/types";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LostReasonDialog } from "./LostReasonDialog";

export interface LeadDetailShape {
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
  billingCycle?: string;
  message?: string;
  source: string;
  attribution: {
    source?: string;
    sourceDetail?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    landing?: string;
    referrer?: string;
    pagePath?: string;
    country?: string;
  };
  stage: string;
  score: number;
  band: string;
  ownerEmail?: string;
  notes: string[];
  nextFollowUpAt?: string;
  lastContactAt?: string;
  estimatedValue: number;
  estimatedValueCurrency?: string;
  demoId?: string;
  lostReason?: string;
  convertedCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventLite {
  id: string;
  type: LeadEventType;
  at: string;
  byEmail?: string;
  summary: string;
  detail?: string;
}

export interface DemoLite {
  id: string;
  leadId: string;
  startAt: string;
  durationMin: number;
  status: string;
  assignedTo?: string;
  meetingUrl?: string;
  notes?: string;
}

const EVENT_TONE: Record<string, string> = {
  created: "bg-zinc-400",
  stage_changed: "bg-indigo-500",
  assigned: "bg-sky-500",
  note_added: "bg-amber-500",
  followup_scheduled: "bg-violet-500",
  email_sent: "bg-emerald-500",
  whatsapp_sent: "bg-emerald-500",
  call_logged: "bg-emerald-500",
  demo_booked: "bg-fuchsia-500",
  demo_completed: "bg-fuchsia-500",
  converted: "bg-emerald-600",
};

const PLAN_OPTIONS = ["solopreneur", "starter", "growth", "professional", "enterprise"];

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function LeadWorkspace({
  lead,
  events,
  demos,
  team,
  capabilities,
}: {
  lead: LeadDetailShape;
  events: EventLite[];
  demos: DemoLite[];
  team: { id: string; name: string; email: string; role: string | null }[];
  capabilities: string[];
}) {
  const canWrite = capabilities.includes("leads.write");
  const canManage = capabilities.includes("leads.manage");
  const canDemos = capabilities.includes("demos.manage");
  const toast = useToast();
  const router = useRouter();

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [timeline, setTimeline] = useState<EventLite[]>(events);
  const [demosState, setDemosState] = useState<DemoLite[]>(demos);
  const [notesState, setNotesState] = useState<string[]>(lead.notes ?? []);
  const [busy, setBusy] = useState(false);
  const [losingStage, setLosingStage] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [confirmWon, setConfirmWon] = useState(false);

  useEffect(() => {
    setDraft({
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? "",
      company: lead.company ?? "",
      propertyName: lead.propertyName ?? "",
      propertyType: lead.propertyType ?? "",
      city: lead.city ?? "",
      country: lead.country ?? "",
      rooms: lead.rooms ? String(lead.rooms) : "",
      currentPms: lead.currentPms ?? "",
      planInterest: lead.planInterest ?? "",
      billingCycle: lead.billingCycle ?? "",
      message: lead.message ?? "",
    });
    setTimeline(events);
    setNotesState(lead.notes ?? []);
    setDemosState(demos);
  }, [lead, events, demos]);

  const patch = (key: string) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const saveFields = async () => {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(`/api/marketing/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          phone: draft.phone || undefined,
          company: draft.company || undefined,
          propertyName: draft.propertyName || undefined,
          propertyType: draft.propertyType || undefined,
          city: draft.city || undefined,
          country: draft.country || undefined,
          rooms: draft.rooms ? Number(draft.rooms) : undefined,
          currentPms: draft.currentPms || undefined,
          planInterest: draft.planInterest || undefined,
          billingCycle: draft.billingCycle || undefined,
          message: draft.message || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const performMoveStage = async (stage: string, lostReason?: LostReason) => {
    if (stage === lead.stage) return;
    setBusy(true);
    const body: Record<string, unknown> = { stage };
    if (stage === "lost" && lostReason) body.lostReason = lostReason;
    const res = await fetch(`/api/marketing/leads/${lead.id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else toast.error((await res.json().catch(() => ({}))).error ?? "Could not move stage");
  };

  /** Stage-change flow: lost requires a structured reason, won asks for
   *  confirmation (it closes the deal), everything else applies directly. */
  const requestMoveStage = (stage: string) => {
    if (stage === lead.stage) return;
    if (stage === "lost") setLosingStage(true);
    else if (stage === "won") setConfirmWon(true);
    else void performMoveStage(stage);
  };

  const addNote = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/marketing/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: trimmed }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotesState(data.lead.notes ?? []);
    }
  };

  const scheduleFollowUp = async (at: string) => {
    if (!at) return;
    const res = await fetch(`/api/marketing/leads/${lead.id}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ at }),
    });
    if (res.ok) setStatus("Follow-up scheduled.");
    else setStatus((await res.json()).error ?? "Could not schedule");
  };

  const logComm = async (kind: "email" | "whatsapp" | "call", detail: string) => {
    const res = await fetch(`/api/marketing/leads/${lead.id}/comm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, detail }),
    });
    if (res.ok) {
      setTimeline((t) => [
        {
          id: `t${Date.now()}`,
          type: kind === "call" ? "call_logged" : kind === "whatsapp" ? "whatsapp_sent" : "email_sent",
          at: new Date().toISOString(),
          summary: `${kind} logged`,
          detail,
        },
        ...t,
      ]);
      setStatus(`${kind} logged.`);
    } else setStatus((await res.json()).error ?? "Could not log");
  };

  const [commDetail, setCommDetail] = useState("");
  const [commKind, setCommKind] = useState<"email" | "whatsapp" | "call">("email");
  const [note, setNote] = useState("");  const [followAt, setFollowAt] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("10:00");
  const [bookAssignee, setBookAssignee] = useState("");
  const [bookMeeting, setBookMeeting] = useState("");

  const bookDemo = async () => {
    if (!bookDate) {
      toast.error("Pick a date before booking the demo.");
      return;
    }
    const startAt = new Date(`${bookDate}T${bookTime}:00`);
    const res = await fetch("/api/marketing/demos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, startAt: startAt.toISOString(), assignedTo: bookAssignee || undefined, meetingUrl: bookMeeting || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setDemosState((d) => [...d, data.demo]);
      setShowBook(false);
      setStatus("Demo booked.");
    } else setStatus((await res.json()).error ?? "Could not book demo");
  };

  const updateDemo = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/marketing/demos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setDemosState((d) => d.map((x) => (x.id === id ? data.demo : x)));
      setStatus("Demo updated.");
    } else setStatus((await res.json()).error ?? "Could not update demo");
  };

  const convert = async () => {
    const res = await fetch(`/api/marketing/leads/${lead.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: draft.planInterest || undefined, billingCycle: draft.billingCycle || undefined, notes: "Converted from marketing admin" }),
    });
    if (res.ok) router.refresh();
    else setStatus((await res.json()).error ?? "Could not convert");
  };

  /** Launch the contact channel in a new window/tab — logging is explicit. */
  const openChannel = (kind: "email" | "whatsapp" | "call") => {
    if (typeof window === "undefined") return;
    if (kind === "email") window.open(`mailto:${lead.email}`, "_self");
    if (kind === "whatsapp") window.open(`https://wa.me/${(lead.phone ?? "").replace(/[^\d]/g, "")}`, "_blank");
    if (kind === "call") window.open(`tel:${lead.phone ?? ""}`, "_self");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title={`${lead.name} · ${lead.email}`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className={STAGE_STYLES[lead.stage as keyof typeof STAGE_STYLES] ?? STAGE_STYLES.new}>{STAGE_LABELS[lead.stage as keyof typeof STAGE_LABELS] ?? lead.stage}</Badge>
            <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{lead.score} · {lead.band.replace("_", " ")}</Badge>
            <Badge>source: {lead.source.replace(/_/g, " ")}</Badge>
            {lead.convertedCustomerId && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">customer ✓</Badge>}
          </div>

          {canWrite && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <Field label="Stage" required>
                <select className={inputCls} value={lead.stage} onChange={(e) => requestMoveStage(e.target.value)} disabled={!canWrite}>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Owner">
                <select className={inputCls} value={lead.ownerEmail ?? ""} disabled={!canWrite}
                  onChange={async (e) => {
                    const res = await fetch(`/api/marketing/leads/${lead.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ownerEmail: e.target.value || undefined }),
                    });
                    if (res.ok) setStatus("Owner assigned.");
                  }}>
                  <option value="">Unassigned</option>
                  {team.map((t) => (
                    <option key={t.id} value={t.email}>{t.name} ({t.role ?? "member"})</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required><input className={inputCls} value={draft.name ?? ""} onChange={patch("name")} disabled={!canWrite} /></Field>
            <Field label="Email" required><input className={inputCls} type="email" value={draft.email ?? ""} onChange={patch("email")} disabled={!canWrite} /></Field>
            <Field label="Phone"><input className={inputCls} value={draft.phone ?? ""} onChange={patch("phone")} disabled={!canWrite} /></Field>
            <Field label="Company"><input className={inputCls} value={draft.company ?? ""} onChange={patch("company")} disabled={!canWrite} /></Field>
            <Field label="Property name"><input className={inputCls} value={draft.propertyName ?? ""} onChange={patch("propertyName")} disabled={!canWrite} /></Field>
            <Field label="Property type"><input className={inputCls} value={draft.propertyType ?? ""} onChange={patch("propertyType")} disabled={!canWrite} /></Field>
            <Field label="City"><input className={inputCls} value={draft.city ?? ""} onChange={patch("city")} disabled={!canWrite} /></Field>
            <Field label="Country"><input className={inputCls} maxLength={2} value={draft.country ?? ""} onChange={patch("country")} disabled={!canWrite} /></Field>
            <Field label="Rooms"><input className={inputCls} type="number" value={draft.rooms ?? ""} onChange={patch("rooms")} disabled={!canWrite} /></Field>
            <Field label="Current PMS"><input className={inputCls} value={draft.currentPms ?? ""} onChange={patch("currentPms")} disabled={!canWrite} /></Field>
            <Field label="Plan interest">
              <select className={inputCls} value={draft.planInterest ?? ""} onChange={patch("planInterest")} disabled={!canWrite}>
                <option value="">—</option>
                {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Billing cycle">
              <select className={inputCls} value={draft.billingCycle ?? ""} onChange={patch("billingCycle")} disabled={!canWrite}>
                <option value="">—</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Message"><textarea className={inputCls} rows={3} value={draft.message ?? ""} onChange={patch("message")} disabled={!canWrite} /></Field>
            </div>
          </div>
          {canWrite && (
            <div className="mt-4 flex items-center gap-2">
              <button className={btnPrimary} onClick={saveFields} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
              {status && <span className="text-xs text-zinc-500 dark:text-zinc-400">{status}</span>}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Attribution">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Source</span><br /><span className="capitalize">{lead.source.replace(/_/g, " ")}</span></p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Campaign</span><br />{lead.attribution.campaign || "—"}</p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Medium</span><br />{lead.attribution.medium || "—"}</p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Term / content</span><br />{lead.attribution.term || lead.attribution.content || "—"}</p>
            <p className="sm:col-span-2"><span className="text-xs font-semibold uppercase text-zinc-400">Landing page</span><br /><span className="font-mono text-xs">{lead.attribution.pagePath || lead.attribution.landing || "—"}</span></p>
            <p className="sm:col-span-2"><span className="text-xs font-semibold uppercase text-zinc-400">Referrer</span><br /><span className="font-mono text-xs">{lead.attribution.referrer || "—"}</span></p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Created</span><br />{fmtDate(lead.createdAt)}</p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Updated</span><br />{fmtDate(lead.updatedAt)}</p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Next follow-up</span><br />{fmtDate(lead.nextFollowUpAt)}</p>
            <p><span className="text-xs font-semibold uppercase text-zinc-400">Est. value (annual)</span><br />{lead.estimatedValue ? formatMoney(lead.estimatedValue, lead.estimatedValueCurrency ?? "USD") : "—"}</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Communication"
          action={
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">
                Last contact {lead.lastContactAt ? fmtDate(lead.lastContactAt) : "—"}
              </span>
              {canManage && <button className={btnGhost} onClick={() => setShowBook(true)}>Book demo</button>}
            </div>
          }
        >
          {canWrite && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Reach out</span>
                <button className={btnGhost} onClick={() => openChannel("email")}>✉ Email</button>
                <button className={btnGhost} onClick={() => openChannel("whatsapp")} disabled={!lead.phone}>WhatsApp</button>
                <button className={btnGhost} onClick={() => openChannel("call")} disabled={!lead.phone}>Call</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Log</span>
                <select
                  className={inputCls + " !w-auto"}
                  value={commKind}
                  onChange={(e) => setCommKind(e.target.value as typeof commKind)}
                  aria-label="Communication type"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Call</option>
                </select>
                <input
                  className={inputCls + " max-w-xs flex-1"}
                  value={commDetail}
                  onChange={(e) => setCommDetail(e.target.value)}
                  placeholder={`What happened on this ${commKind}?`}
                  onKeyDown={(e) => { if (e.key === "Enter") { void logComm(commKind, commDetail || "No detail given"); setCommDetail(""); } }}
                />
                <button className={btnPrimary} onClick={() => { void logComm(commKind, commDetail || "No detail given"); setCommDetail(""); }}>
                  Log {commKind}
                </button>
              </div>
            </div>
          )}
          {demosState.length > 0 && (
            <ul className="mt-4 space-y-2">
              {demosState.map((d) => (
                <li key={d.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{fmtDate(d.startAt)}</span>
                    <span className="text-xs text-zinc-400">{d.durationMin} min</span>
                    <Badge>{d.status}</Badge>
                    {canDemos && (
                      <select className={inputCls + " !w-auto !py-1 text-xs"} value={d.status}
                        onChange={(e) => updateDemo(d.id, { status: e.target.value })}>
                        {["new", "confirmed", "reschedule_requested", "completed", "no_show", "cancelled", "converted"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                    {d.assignedTo && <span className="text-xs text-zinc-400">→ {d.assignedTo}</span>}
                  </div>
                  {d.meetingUrl && <a href={d.meetingUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-indigo-600 hover:underline dark:text-indigo-400">{d.meetingUrl}</a>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="Timeline">
          {timeline.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-3">
              {timeline.map((e) => (
                <li key={e.id} className="flex gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_TONE[e.type] ?? "bg-zinc-400"}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-200">{e.summary}</p>
                    {e.detail && <p className="text-xs text-zinc-400">{e.detail}</p>}
                    <p className="text-[10px] text-zinc-400">{fmtDate(e.at)}{e.byEmail ? ` · ${e.byEmail}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Notes">
          <ul className="mb-3 max-h-52 space-y-2 overflow-y-auto">
            {notesState.length === 0 ? (
              <p className="text-xs text-zinc-400">No notes yet.</p>
            ) : (
              notesState.map((n, i) => (
                <li key={i} className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-300">{n}</li>
              ))
            )}
          </ul>
          {canWrite && (
            <div className="flex gap-2">
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" onKeyDown={(e) => { if (e.key === "Enter") { addNote(note); setNote(""); } }} />
              <button className={btnPrimary} onClick={() => { addNote(note); setNote(""); }}>Add</button>
            </div>
          )}
        </SectionCard>

        {canWrite && (
          <SectionCard title="Follow-up">
            <div className="flex gap-2">
              <input className={inputCls} type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} aria-label="Follow-up time" />
              <button className={btnPrimary} onClick={() => scheduleFollowUp(followAt)}>Schedule</button>
            </div>
          </SectionCard>
        )}

        {canManage && (
          <SectionCard title="Convert to customer">
            <p className="mb-3 text-xs text-zinc-400">
              Converting creates the customer record and preserves the original
              source, campaign, country, room count, plan and demo history. The
              lead then becomes read-only in the CRM.
            </p>
            <button className={btnPrimary + " w-full"} onClick={() => setConfirmConvert(true)} disabled={Boolean(lead.convertedCustomerId)}>
              {lead.convertedCustomerId ? "Converted ✓" : "Convert to customer"}
            </button>
          </SectionCard>
        )}
      </div>

      <Modal open={showBook} onClose={() => setShowBook(false)} title="Book demo for this lead">
        <div className="space-y-3">
          <Field label="Date" required><input className={inputCls} type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} /></Field>
          <Field label="Time (local)">
            <select className={inputCls} value={bookTime} onChange={(e) => setBookTime(e.target.value)}>
              {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Salesperson">
            <select className={inputCls} value={bookAssignee} onChange={(e) => setBookAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map((t) => <option key={t.id} value={t.email}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Meeting URL"><input className={inputCls} value={bookMeeting} onChange={(e) => setBookMeeting(e.target.value)} placeholder="https://meet…" /></Field>
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setShowBook(false)}>Cancel</button>
            <button className={btnPrimary} onClick={bookDemo}>Book demo</button>
          </div>
        </div>
      </Modal>

      {losingStage && (
        <LostReasonDialog
          leadName={lead.name}
          onClose={() => setLosingStage(false)}
          onConfirm={(reason) => {
            setLosingStage(false);
            void performMoveStage("lost", reason);
          }}
        />
      )}

      <ConfirmDialog
        action={confirmWon
          ? {
              title: "Mark as won",
              message: `Mark ${lead.name} as won?`,
              consequences: [
                "The deal is counted in win-rate and conversion reporting.",
                "You can re-open the lead afterwards; the change is logged.",
              ],
              confirmLabel: "Mark won",
            }
          : null}
        onClose={() => setConfirmWon(false)}
        onConfirm={() => {
          setConfirmWon(false);
          void performMoveStage("won");
        }}
      />

      <ConfirmDialog
        action={confirmConvert
          ? {
              title: "Convert lead to customer",
              message: `Convert ${lead.name} to a paying customer?`,
              consequences: [
                "A customer organization is created for this lead.",
                "Attribution (source, campaign, country, plan) is preserved.",
                "The lead becomes read-only in the CRM.",
              ],
              confirmLabel: "Convert",
            }
          : null}
        onClose={() => setConfirmConvert(false)}
        onConfirm={() => void convert()}
      />
    </div>
  );
}