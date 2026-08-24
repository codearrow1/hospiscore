"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DetailDrawer, DrawerSection, KeyValue } from "@/components/ui/DetailDrawer";
import Link from "next/link";

type Ticket = {
  id: string; organizationId: string; category: string; priority: string; status: string;
  subject: string; description?: string | null;
  assigneeEmail?: string | null; slaDueAt?: string | null; createdAt: string;
  requesterEmail?: string | null;
  firstResponseAt?: Date | null; resolvedAt?: Date | null;
  organization?: { legalName: string };
};
type Opt = { id: string; label: string };

const CATEGORIES = ["billing","technical","subscription","account","integration","bug","onboarding","affiliate","partner","franchise"];
const STATUSES = ["open", "pending", "in_progress", "resolved", "closed"] as const;

/** Mirror of the server-side transition rules (lib/saas/support.ts) so the UI
 *  never offers an illegal move; the API re-validates authoritatively. */
const NEXT_STATUSES: Record<string, string[]> = {
  open: ["pending", "in_progress", "resolved", "closed"],
  pending: ["in_progress", "resolved", "closed"],
  in_progress: ["pending", "resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

function fmtDue(iso: string): string {
  const d = new Date(iso);
  const diffH = Math.round((d.getTime() - Date.now()) / 3600000);
  if (diffH < -48) return `${Math.abs(Math.round(diffH / 24))}d overdue`;
  if (diffH < 0) return `${Math.abs(diffH)}h overdue`;
  return diffH < 24 ? `due in ${diffH}h` : d.toLocaleDateString();
}

export default function TicketsManager({ initialTickets, canManage, orgs = [] }: {
  initialTickets: Ticket[];
  canManage: boolean;
  orgs?: Opt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tickets, setTickets] = useState(initialTickets);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<Ticket | null>(null);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ priority: "medium", category: "billing" });
  const [error, setError] = useState("");
  // Triage filters
  const [fStatus, setFStatus] = useState("active");
  const [fPriority, setFPriority] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [breachedOnly, setBreachedOnly] = useState(false);

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const refresh = async () => {
    const res = await fetch("/api/saas/support");
    if (res.ok) { const d = await res.json(); setTickets(d.tickets); router.refresh(); }
  };

  const create = async () => {
    setError("");
    const res = await fetch("/api/saas/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Create failed"); return; }
    setCreating(false); setForm({ priority: "medium", category: "billing" }); refresh();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/saas/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error ?? "Update failed"); return false; }
    toast.success("Ticket updated");
    setDetail((cur) => (cur && cur.id === id && d.ticket ? { ...cur, ...d.ticket } : cur));
    await refresh();
    return true;
  };

  const transition = async (t: Ticket, status: string) => {
    const ok = await patch(t.id, { status, ...(status === "in_progress" ? { firstResponse: true } : {}) });
    if (ok && status === "closed") setClosing(null);
  };

  const saveAssignee = async (t: Ticket) => {
    await patch(t.id, { assigneeEmail: detail?.assigneeEmail ?? "" });
  };

  /** SLA state: open work items past their due time are breached. */
  const isBreached = (t: Ticket) =>
    !!t.slaDueAt && !["resolved", "closed"].includes(t.status) && new Date(t.slaDueAt).getTime() < Date.now();

  const filtered = useMemo(() => tickets.filter((t) => {
    if (fStatus === "active" ? !["open", "pending", "in_progress"].includes(t.status)
      : fStatus !== "all" && t.status !== fStatus) return false;
    if (fPriority && t.priority !== fPriority) return false;
    if (fCategory && t.category !== fCategory) return false;
    if (breachedOnly && !isBreached(t)) return false;
    return true;
  }), [tickets, fStatus, fPriority, fCategory, breachedOnly]);

  const counts = useMemo(() => ({
    active: tickets.filter((t) => ["open", "pending", "in_progress"].includes(t.status)).length,
    breached: tickets.filter((t) => isBreached(t)).length,
    urgentOpen: tickets.filter((t) => t.priority === "urgent" && ["open", "pending", "in_progress"].includes(t.status)).length,
  }), [tickets]);

  return (
    <div className="space-y-4">
      {/* Triage bar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {[["active", `Active (${counts.active})`], ["all", "All"], ...STATUSES.map((s) => [s, s] as const)].map(([key, label]) => (
          <button key={key}
            onClick={() => setFStatus(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
              fStatus === key
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}>{label}</button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block dark:bg-zinc-700" />
        <select aria-label="Priority filter" className="rounded-lg border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-700" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="">Any priority</option>
          {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Category filter" className="rounded-lg border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-700" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
          <option value="">Any category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setBreachedOnly((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            breachedOnly ? "bg-red-600 text-white" : "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
          }`}>SLA breached{breachedOnly ? "" : ` (${counts.breached})`}</button>
        <div className="ml-auto"><button onClick={() => setCreating(true)} disabled={!canManage} className={btnPrimary}>+ New Ticket</button></div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">Ticket</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Assignee</th>
          </tr></thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} onClick={() => setDetail(t)} className={`cursor-pointer border-t hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${isBreached(t) ? "bg-red-50/60 dark:bg-red-950/20" : ""}`}>
                <td className="px-3 py-2"><span className="font-medium">{t.subject}</span><span className="block text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</span></td>
                <td className="px-3 py-2 text-xs"><Link href={`/saas/organizations/${t.organizationId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.organization?.legalName ?? t.organizationId.slice(0, 8)}</Link></td>
                <td className="px-3 py-2 text-xs">{t.category}</td>
                <td className="px-3 py-2"><span className={`text-xs font-semibold ${t.priority === "urgent" ? "text-red-600" : t.priority === "high" ? "text-orange-500" : ""}`}>{t.priority}</span></td>
                <td className="px-3 py-2 space-y-0.5">
                  <Badge>{t.status.replace("_", " ")}</Badge>
                  {isBreached(t) && <Badge><span className="text-red-600 dark:text-red-400">{fmtDue(t.slaDueAt!)}</span></Badge>}
                  {!isBreached(t) && t.slaDueAt && !["resolved", "closed"].includes(t.status) && <Badge><span className="text-zinc-500">{fmtDue(t.slaDueAt)}</span></Badge>}
                </td>
                <td className="px-3 py-2 text-xs">{t.assigneeEmail ?? <span className="text-zinc-400">unassigned</span>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-400">No tickets match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Ticket detail drawer */}
      <DetailDrawer open={detail !== null} onClose={() => setDetail(null)} title={detail?.subject ?? ""} subtitle={detail ? `${detail.category} · ${detail.priority}` : undefined}>
        {detail && (
          <div className="space-y-4">
            <DrawerSection title="Details">
              <KeyValue label="Customer">
                <Link href={`/saas/organizations/${detail.organizationId}`} className="text-blue-600 hover:underline dark:text-blue-400">{detail.organization?.legalName ?? detail.organizationId.slice(0, 8)}</Link>
              </KeyValue>
              <KeyValue label="Requester">{detail.requesterEmail ?? "—"}</KeyValue>
              <KeyValue label="Assignee">{detail.assigneeEmail ?? "unassigned"}</KeyValue>
              <KeyValue label="Created">{new Date(detail.createdAt).toLocaleString()}</KeyValue>
              {detail.slaDueAt && !["resolved", "closed"].includes(detail.status) && (
                <KeyValue label="SLA"><span className={isBreached(detail) ? "font-semibold text-red-600 dark:text-red-400" : ""}>{fmtDue(detail.slaDueAt)}</span></KeyValue>
              )}
            </DrawerSection>
            {detail.description && (
              <DrawerSection title="Description">
                <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{detail.description}</p>
              </DrawerSection>
            )}
            {canManage && (
              <DrawerSection title="Actions">
                <div className="space-y-3">
                  <Field label="Assign to (email)">
                    <input className={inputCls} type="email" placeholder="agent@hospitalos.com"
                      value={(detail.assigneeEmail as string | null) ?? ""}
                      onChange={(e) => setDetail((cur) => (cur ? { ...cur, assigneeEmail: e.target.value || null } : cur))}
                    />
                  </Field>
                  <button className={btnGhost} onClick={() => saveAssignee(detail)}>Save assignment</button>
                  <Field label="Priority">
                    <select className={inputCls} value={detail.priority}
                      onChange={(e) => setDetail((cur) => (cur ? { ...cur, priority: e.target.value } : cur))}>
                      {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <button className={btnGhost} onClick={() => patch(detail.id, { priority: detail.priority })}>Save priority</button>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Move to</p>
                    {(NEXT_STATUSES[detail.status] ?? []).length === 0 ? (
                      <p className="text-xs text-zinc-400">Terminal state — no further transitions.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(NEXT_STATUSES[detail.status] ?? []).map((s) => (
                          <button key={s}
                            onClick={() => (s === "closed" ? setClosing(detail) : transition(detail, s))}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              s === "resolved" ? "bg-emerald-600 text-white hover:bg-emerald-500"
                              : s === "closed" ? "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800"
                              : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            }`}>{s.replace("_", " ")}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </DrawerSection>
            )}
            <p className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-400 dark:bg-zinc-800/50">
              BACKEND GAP: threaded replies/comments are not yet modeled (no TicketComment table). Status history lives in the audit log.
            </p>
          </div>
        )}
      </DetailDrawer>

      <Modal open={creating} onClose={() => setCreating(false)} title="New Support Ticket">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organization" required>
              <select className={inputCls} value={form.organizationId ?? ""} onChange={set("organizationId")}>
                <option value="">— select organization —</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Requester email"><input className={inputCls} type="email" value={form.requesterEmail ?? ""} onChange={set("requesterEmail")} /></Field>
            <Field label="Category" required><select className={inputCls} value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Priority"><select className={inputCls} value={form.priority} onChange={set("priority")}><option value="low">low (72h)</option><option value="medium">medium (24h)</option><option value="high">high (8h)</option><option value="urgent">urgent (4h)</option></select></Field>
          </div>
          <Field label="Subject" required><input className={inputCls} value={form.subject ?? ""} onChange={set("subject")} /></Field>
          <Field label="Description"><textarea className={inputCls} rows={3} value={form.description ?? ""} onChange={set("description")} /></Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setCreating(false)}>Cancel</button>
            <button className={btnPrimary} disabled={!form.organizationId || !form.subject} onClick={create}>Create</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        action={closing
          ? {
              title: "Close ticket",
              message: `Close "${closing.subject}"?`,
              consequences: [
                "The ticket becomes read-only for everyone.",
                "The requester can no longer add replies.",
                "This does not delete any ticket history.",
              ],
              confirmLabel: "Close ticket",
              tone: "warning",
            }
          : null}
        onClose={() => setClosing(null)}
        onConfirm={() => closing && transition(closing, "closed")}
      />
    </div>
  );
}
