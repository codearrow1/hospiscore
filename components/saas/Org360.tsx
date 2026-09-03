"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DetailDrawer, DrawerSection, KeyValue } from "@/components/ui/DetailDrawer";
import { StatusBadge } from "@/components/ui/Badge";

const ORG_TRANSITIONS: Record<string, { label: string; tone: "warning" | "danger"; consequences: string[] }> = {
  suspended: {
    label: "Suspend",
    tone: "warning",
    consequences: [
      "The organization loses access to its workspaces immediately.",
      "Subscriptions stay on the books; billing is not automatically stopped.",
      "You can reactivate at any time from this page.",
    ],
  },
  cancelled: {
    label: "Cancel",
    tone: "danger",
    consequences: [
      "The customer relationship is marked cancelled.",
      "Portal access ends for all of this organization's contacts.",
      "Historical invoices, usage, and audit history are preserved.",
      "Reactivation requires creating a new subscription.",
    ],
  },
  active: {
    label: "Reactivate",
    tone: "warning",
    consequences: ["Access is restored for all contacts.", "Billing resumes on the next sweep if a subscription is active."],
  },
};

export function OrgActions({ orgId, status, canManage }: { orgId: string; status: string; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = Object.entries(ORG_TRANSITIONS).filter(([s]) => s !== status);

  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/saas/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pending }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Update failed");
        return;
      }
      setPending(null);
      setMenuOpen(false);
      toast.success(`Organization marked ${pending}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!canManage || options.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        Actions ▾
      </button>
      {menuOpen && (
        <ul className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map(([s, cfg]) => (
            <li key={s}>
              <button type="button" onClick={() => { setMenuOpen(false); setPending(s); }} className="block w-full px-3 py-2 text-left font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                {cfg.label}
                <span className="block text-[10px] font-normal text-zinc-400">→ {s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        action={pending ? { title: ORG_TRANSITIONS[pending].label + " organization", message: `Set status to "${pending}"?`, consequences: ORG_TRANSITIONS[pending].consequences, confirmLabel: ORG_TRANSITIONS[pending].label, tone: ORG_TRANSITIONS[pending].tone } : null}
        onClose={() => setPending(null)}
        onConfirm={apply}
        busy={busy}
      />
    </div>
  );
}

export type PropRow = { id: string; name: string; city: string | null; country: string | null; rooms: number | null; status: string };
export type SubRow = { id: string; planName: string; billingCycle: string; status: string; mrrLabel: string; periodStart: string; periodEnd: string };
export type InvoiceRow = { id: string; type: string; status: string; amountLabel: string; dueAt: string | null; createdAt: string };

/** Row tables whose rows open a contextual detail drawer. */
export function Org360Tables({
  properties,
  subscriptions,
  invoices,
}: {
  properties: PropRow[];
  subscriptions: SubRow[];
  invoices: InvoiceRow[];
}) {
  const [detail, setDetail] = useState<
    | { kind: "property"; row: PropRow }
    | { kind: "subscription"; row: SubRow }
    | { kind: "invoice"; row: InvoiceRow }
    | null
  >(null);

  return (
    <>
      {/* Properties */}
      {properties.length === 0 ? (
        <p className="text-sm text-zinc-500">No properties yet — add the customer&apos;s PMS instances. These are SaaS tenant references, not hotel operational data.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800"><th className="py-1">Name</th><th className="py-1">City</th><th className="py-1">Country</th><th className="py-1">Rooms</th><th className="py-1">Status</th></tr></thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} onClick={() => setDetail({ kind: "property", row: p })} className="cursor-pointer border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                <td className="py-1.5 font-medium">{p.name}</td>
                <td className="py-1.5">{p.city || "—"}</td><td className="py-1.5">{p.country || "—"}</td><td className="py-1.5">{p.rooms ?? "—"}</td>
                <td className="py-1.5"><StatusBadge domain="organization" status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800"><th className="py-1">Plan</th><th className="py-1">Cycle</th><th className="py-1">Status</th><th className="py-1">MRR</th><th className="py-1">Period</th></tr></thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id} onClick={() => setDetail({ kind: "subscription", row: s })} className="cursor-pointer border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                <td className="py-1.5">{s.planName}</td><td className="py-1.5">{s.billingCycle}</td>
                <td className="py-1.5"><StatusBadge domain="subscription" status={s.status} /></td>
                <td className="py-1.5 tabular-nums">{s.mrrLabel}</td>
                <td className="py-1.5 text-xs">{s.periodStart} → {s.periodEnd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800"><th className="py-1">Type</th><th className="py-1">Status</th><th className="py-1">Amount</th><th className="py-1">Due</th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} onClick={() => setDetail({ kind: "invoice", row: i })} className="cursor-pointer border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                <td className="py-1.5">{i.type}</td>
                <td className="py-1.5"><StatusBadge domain="invoice" status={i.status} /></td>
                <td className="py-1.5 tabular-nums">{i.amountLabel}</td>
                <td className="py-1.5 text-xs">{i.dueAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <DetailDrawer
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.kind === "property" ? detail.row.name : detail?.kind === "subscription" ? detail.row.planName : detail?.kind === "invoice" ? `${detail.row.type} invoice` : ""}
        subtitle={detail?.kind === "subscription" ? detail.row.status : detail?.kind === "invoice" ? detail.row.status : undefined}
      >
        {detail?.kind === "property" && (
          <DrawerSection title="Property">
            <dl>
              <KeyValue label="Name">{detail.row.name}</KeyValue>
              <KeyValue label="City">{detail.row.city ?? "—"}</KeyValue>
              <KeyValue label="Country">{detail.row.country ?? "—"}</KeyValue>
              <KeyValue label="Rooms">{detail.row.rooms ?? "∞"}</KeyValue>
              <KeyValue label="Status"><StatusBadge domain="organization" status={detail.row.status} /></KeyValue>
            </dl>
          </DrawerSection>
        )}
        {detail?.kind === "subscription" && (
          <>
            <DrawerSection title="Subscription">
              <dl>
                <KeyValue label="Plan">{detail.row.planName}</KeyValue>
                <KeyValue label="Cycle">{detail.row.billingCycle}</KeyValue>
                <KeyValue label="Status"><StatusBadge domain="subscription" status={detail.row.status} /></KeyValue>
                <KeyValue label="MRR">{detail.row.mrrLabel}</KeyValue>
              </dl>
            </DrawerSection>
            <DrawerSection title="Current period">
              <dl>
                <KeyValue label="Start">{detail.row.periodStart}</KeyValue>
                <KeyValue label="End">{detail.row.periodEnd}</KeyValue>
              </dl>
            </DrawerSection>
          </>
        )}
        {detail?.kind === "invoice" && (
          <DrawerSection title="Invoice">
            <dl>
              <KeyValue label="Type">{detail.row.type}</KeyValue>
              <KeyValue label="Status"><StatusBadge domain="invoice" status={detail.row.status} /></KeyValue>
              <KeyValue label="Amount">{detail.row.amountLabel}</KeyValue>
              <KeyValue label="Due">{detail.row.dueAt ?? "—"}</KeyValue>
              <KeyValue label="Created">{detail.row.createdAt}</KeyValue>
            </dl>
          </DrawerSection>
        )}
        <DrawerSection>
          <Link href="/saas/billing" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Open Billing Manager →</Link>
        </DrawerSection>
      </DetailDrawer>
    </>
  );
}
