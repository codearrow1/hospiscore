"use client";

/**
 * CustomerPortalClient — self-service sections of the customer portal.
 * Server page passes billing/subscription facts; interactive sections
 * (support, team, properties, invoice detail) talk to scoped /api/customer/*
 * endpoints. Self-pay is honestly labeled as a backend gap.
 */
import { useCallback, useEffect, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, SectionCard, EmptyState, Badge } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";
import Link from "next/link";

export interface PortalSubscription {
  planName: string;
  billingCycle: string;
  mrrCents: number;
  status: string;
  periodStartISO: string | null;
  periodEndISO: string | null;
}

export interface PortalInvoice {
  id: string;
  createdAtISO: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  dueAtISO: string | null;
  paidAtISO: string | null;
}

interface TicketRow { id: string; subject: string; status: string; category: string; priority: string; createdAt: string }
interface TeamRow { id: string; name: string; email: string; role: string | null; isPrimary: boolean }
interface PropertyRow { id: string; name: string; city: string | null; country: string | null; rooms: number | null; status: string }

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

/** Renewal countdown chip — color scales as the period end approaches. */
function RenewalCountdown({ sub }: { sub: PortalSubscription }) {
  const days = daysUntil(sub.periodEndISO);
  if (days === null || !sub.periodEndISO) {
    return <p className="text-sm text-zinc-400">No renewal date yet.</p>;
  }
  const tone =
    days < 0 ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    : days <= 7 ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200";
  return (
    <div className={`inline-flex items-baseline gap-2 rounded-xl border px-3 py-2 ${tone}`}>
      <span className="text-2xl font-bold tabular-nums">{days < 0 ? "overdue" : days}</span>
      <span className="text-xs font-semibold uppercase tracking-wide">
        {days < 0 ? "renewal past due" : `day${days === 1 ? "" : "s"} to renewal`}
      </span>
      <span className="text-xs opacity-75">{new Date(sub.periodEndISO).toLocaleDateString()}</span>
    </div>
  );
}

function SupportSection() {
  const toast = useToast();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("account");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/customer/support").catch(() => null);
    if (res?.ok) setTickets((await res.json()).tickets ?? []);
    else setTickets([]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/customer/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, description }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Could not send"); return; }
      setSubject(""); setDescription("");
      toast.success("Ticket created");
      void load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Support">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="space-y-2.5">
          <Field label="Subject"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need?" /></Field>
          <Field label="Category">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {["account", "billing", "technical", "subscription", "integration", "onboarding"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Details"><textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional context that helps us help you faster" /></Field>
          <button className={btnPrimary} disabled={busy || subject.trim().length < 4} onClick={submit}>{busy ? "Sending…" : "Create ticket"}</button>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Your tickets</p>
          {tickets === null ? <p className="text-xs text-zinc-400">Loading…</p> : tickets.length === 0 ? (
            <EmptyState title="No tickets yet" body="Anything you send appears here with live status." />
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {tickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate" title={t.subject}>{t.subject}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" title="Priority">{t.priority}</span>
                    <StatusBadge domain="ticket" status={t.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function TeamSection() {
  const toast = useToast();
  const [contacts, setContacts] = useState<TeamRow[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("tech");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/customer/team").catch(() => null);
    if (res?.ok) setContacts((await res.json()).contacts ?? []);
    else setContacts([]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const invite = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/customer/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Invite failed"); return; }
      if (d.notice) toast.success(d.notice);
      else toast.success("Team member added");
      setName(""); setEmail("");
      void load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/customer/team?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error ?? "Remove failed"); return; }
    void load();
  };

  const setPrimary = async (id: string) => {
    const res = await fetch("/api/customer/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, transferPrimary: true }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error ?? "Transfer failed"); return; }
    toast.success("Primary contact updated");
    void load();
  };

  const changeRole = async (id: string, role: string) => {
    const res = await fetch("/api/customer/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error ?? "Role update failed"); return; }
    void load();
  };

  return (
    <SectionCard title="Team &amp; contacts">
      <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {(contacts ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <span className="font-medium">{c.name}{c.isPrimary && <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">primary</span>}</span>
              <span className="block truncate text-xs text-zinc-500">{c.email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <select
                value={c.role ?? "tech"}
                onChange={(e) => changeRole(c.id, e.target.value)}
                className={inputCls + " !w-auto !py-1 !text-xs"}
                aria-label={`Change role for ${c.name}`}
              >
                <option value="owner">owner</option>
                <option value="billing">billing</option>
                <option value="tech">tech</option>
              </select>
              {!c.isPrimary && (
                <>
                  <button onClick={() => setPrimary(c.id)} className={btnGhost + " !py-1 !text-xs"} aria-label={`Make ${c.name} primary`}>Primary</button>
                  <button onClick={() => remove(c.id)} className={btnGhost + " !py-1 !text-xs"} aria-label={`Remove ${c.name}`}>Remove</button>
                </>
              )}
            </span>
          </li>
        ))}
        {contacts !== null && contacts.length === 0 && <li className="py-3 text-center text-xs text-zinc-400">No contacts yet.</li>}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Role">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="tech">tech</option><option value="billing">billing</option><option value="owner">owner</option>
          </select>
        </Field>
        <button className={btnPrimary + " mb-0.5"} disabled={busy || !name || !email} onClick={invite}>Invite</button>
      </div>
      <p className="mt-1 text-[11px] italic text-zinc-400">
        Invites register your colleague as an org contact. Invitation emails are not wired yet (backend gap) — share the portal link directly. Identity binds automatically when they register with this email.
      </p>
    </SectionCard>
  );
}

function PropertiesSection() {
  const toast = useToast();
  const [properties, setProperties] = useState<PropertyRow[] | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [rooms, setRooms] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/customer/properties").catch(() => null);
    if (res?.ok) setProperties((await res.json()).properties ?? []);
    else setProperties([]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/customer/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city: city || undefined, country: country || undefined, rooms: rooms || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Add failed"); return; }
      setName(""); setCity(""); setCountry(""); setRooms("");
      toast.success("Property added");
      void load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Properties">
      <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {(properties ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between py-1.5">
            <span className="min-w-0 truncate font-medium">{p.name}</span>
            <span className="shrink-0 text-xs text-zinc-500">
              {[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.rooms ? `${p.rooms} rooms` : "rooms unknown"}
            </span>
          </li>
        ))}
        {properties !== null && properties.length === 0 && <li className="py-3 text-center text-xs text-zinc-400">No properties yet — add your first one above.</li>}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_0.6fr_0.6fr_auto] sm:items-end">
        <Field label="Property name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="City"><input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
        <Field label="Country"><input className={inputCls} maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} /></Field>
        <Field label="Rooms"><input className={inputCls} type="number" min={1} value={rooms} onChange={(e) => setRooms(e.target.value)} /></Field>
        <button className={btnPrimary + " mb-0.5"} disabled={busy || name.trim().length < 2} onClick={add}>Add</button>
      </div>
    </SectionCard>
  );
}

export default function CustomerPortalClient({
  orgLabel,
  healthStatus,
  subscription,
  outstandingCents,
  usage30d,
  invoices,
}: {
  orgLabel: string;
  healthStatus: string;
  subscription: PortalSubscription | null;
  outstandingCents: number;
  usage30d: { metric: string; quantity: number }[];
  invoices: PortalInvoice[];
}) {
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);

  const needsPayment = outstandingCents > 0;
  const subAttention = subscription && ["past_due", "grace"].includes(subscription.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Customer Portal</h1>
          <p className="mt-1 text-sm text-zinc-600">{orgLabel}</p>
        </div>
        <Badge>{healthStatus}</Badge>
      </div>

      {/* Outstanding banner — self-serve Pay Now surface */}
      {(needsPayment || subAttention) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
           {needsPayment && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Outstanding balance {formatMoney(outstandingCents, "USD")}.
              </p>
              <a href="/customer/billing" className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700">
                Pay now
              </a>
            </div>
          )}
          {subAttention && (
            <p className={`text-sm font-semibold text-amber-800 dark:text-amber-200 ${needsPayment ? "mt-1.5" : ""}`}>
              Your subscription is {subscription!.status} — update your payment method to avoid interruption.
            </p>
          )}
        </div>
      )}

      {/* Subscription overview + renewal countdown */}
      <SectionCard title="Subscription overview">
        <div id="subscription" />
        {!subscription ? (
          <EmptyState title="No subscription yet." body="Your account team will activate your plan shortly." />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">{subscription.planName}</span>{" "}
                <span className="text-zinc-500">({subscription.billingCycle})</span> —{" "}
                {formatMoney(subscription.mrrCents, "USD")}/mo
              </p>
              <p className="text-xs text-zinc-500">
                Current period:{" "}
                {subscription.periodStartISO ? new Date(subscription.periodStartISO).toLocaleDateString() : "?"} →{" "}
                {subscription.periodEndISO ? new Date(subscription.periodEndISO).toLocaleDateString() : "?"}
              </p>
              <StatusBadge domain="subscription" status={subscription.status} />
            </div>
            <RenewalCountdown sub={subscription} />
          </div>
        )}
      </SectionCard>

      {/* Usage */}
      <SectionCard title="Usage (last 30 days)">
        <div id="usage" />
        {usage30d.length === 0 ? (
          <EmptyState title="No usage recorded." />
        ) : (
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {usage30d.map((u) => (
              <li key={u.metric} className="rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
                <span className="font-medium tabular-nums">{u.quantity.toLocaleString()}</span>{" "}
                <span className="text-zinc-500">{u.metric.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Billing history with expandable invoice detail */}
      <SectionCard title="Billing history">
        <div id="billing" />
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet." />
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <button
                  className="flex w-full items-center justify-between gap-2 py-2 text-left"
                  onClick={() => setOpenInvoice(openInvoice === inv.id ? null : inv.id)}
                  aria-expanded={openInvoice === inv.id}
                >
                  <span className="min-w-0 text-zinc-600">
                    {new Date(inv.createdAtISO).toLocaleDateString()} · {inv.type.replace(/_/g, " ")}
                    {openInvoice === inv.id && <span className="ml-1.5 text-xs text-zinc-400">(click to collapse)</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium tabular-nums">{formatMoney(inv.amount, inv.currency)}</span>
                    <StatusBadge domain="invoice" status={inv.status} />
                    <span aria-hidden className="w-3 text-zinc-400">{openInvoice === inv.id ? "▾" : "▸"}</span>
                  </span>
                </button>
                {openInvoice === inv.id && (
                  <dl className="mb-2 ml-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-zinc-100 p-3 text-xs dark:border-zinc-800">
                    <dt className="text-zinc-500">Invoice ID</dt><dd className="break-all font-mono">{inv.id}</dd>
                    <dt className="text-zinc-500">Type</dt><dd>{inv.type.replace(/_/g, " ")}</dd>
                    <dt className="text-zinc-500">Amount</dt><dd className="tabular-nums">{formatMoney(inv.amount, inv.currency)}</dd>
                    <dt className="text-zinc-500">Issued</dt><dd>{new Date(inv.createdAtISO).toLocaleString()}</dd>
                    <dt className="text-zinc-500">Due</dt><dd>{inv.dueAtISO ? new Date(inv.dueAtISO).toLocaleDateString() : "—"}</dd>
                    <dt className="text-zinc-500">Paid</dt><dd>{inv.paidAtISO ? new Date(inv.paidAtISO).toLocaleDateString() : "not paid yet"}</dd>
                    <dt className="text-zinc-500">Printable copy</dt>
                    <dd><Link href={`/customer/invoices/${inv.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">Open invoice view →</Link></dd>
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] italic text-zinc-400">
          Use &ldquo;Open invoice view&rdquo; for a print-ready page, or click &ldquo;Download PDF&rdquo; on the invoice page.
        </p>
      </SectionCard>

      <SupportSection />
      <PropertiesSection />
      <TeamSection />
    </div>
  );
}
