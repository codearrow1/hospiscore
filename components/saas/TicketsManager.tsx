"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnGhost, btnPrimary, Field, inputCls, Modal, Badge } from "@/components/marketing-admin/ui";
import Link from "next/link";

type Ticket = {
  id: string; organizationId: string; category: string; priority: string; status: string;
  subject: string; assigneeEmail?: string | null; slaDueAt?: string | null; createdAt: string;
  organization?: { legalName: string };
};

const CATEGORIES = ["billing","technical","subscription","account","integration","bug","onboarding","affiliate","partner","franchise"];

export default function TicketsManager({ initialTickets, canManage }: { initialTickets: Ticket[]; canManage: boolean }) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initialTickets);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ priority: "medium", category: "billing" });
  const [error, setError] = useState("");
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

  const transition = async (id: string, status: string) => {
    const res = await fetch(`/api/saas/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, firstResponse: true }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Update failed"); return; }
    refresh();
  };

  const slaLabel = (t: Ticket) => {
    if (!t.slaDueAt || t.status === "resolved" || t.status === "closed") return null;
    const overdue = new Date(t.slaDueAt).getTime() < Date.now();
    return <Badge>{overdue ? "SLA breached" : "in SLA"}</Badge>;
  };

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><button onClick={() => setCreating(true)} className={btnPrimary}>+ New Ticket</button></div>}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-zinc-400">
            <th className="px-3 py-2">Ticket</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Assignee</th><th className="px-3 py-2">Actions</th>
          </tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2"><span className="font-medium">{t.subject}</span><span className="block text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</span></td>
                <td className="px-3 py-2 text-xs"><Link href={`/saas/organizations/${t.organizationId}`} className="hover:underline">{t.organization?.legalName ?? t.organizationId.slice(0, 8)}</Link></td>
                <td className="px-3 py-2 text-xs">{t.category}</td>
                <td className="px-3 py-2"><span className={`text-xs font-semibold ${t.priority === "urgent" ? "text-red-600" : t.priority === "high" ? "text-orange-500" : ""}`}>{t.priority}</span></td>
                <td className="px-3 py-2"><Badge>{t.status}</Badge> {slaLabel(t)}</td>
                <td className="px-3 py-2 text-xs">{t.assigneeEmail ?? "—"}</td>
                <td className="px-3 py-2 space-x-1">
                  {canManage && t.status === "open" && <button onClick={() => transition(t.id, "in_progress")} className={btnGhost}>Start</button>}
                  {canManage && ["open", "pending", "in_progress"].includes(t.status) && <button onClick={() => transition(t.id, "resolved")} className={btnGhost}>Resolve</button>}
                  {canManage && t.status === "resolved" && <button onClick={() => transition(t.id, "closed")} className={btnGhost}>Close</button>}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No tickets</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New Support Ticket">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organization ID" required><input className={inputCls} value={form.organizationId ?? ""} onChange={set("organizationId")} /></Field>
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
    </div>
  );
}
