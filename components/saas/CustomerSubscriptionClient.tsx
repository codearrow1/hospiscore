"use client";

/**
 * CustomerSubscriptionClient — self-service plan change, cancellation,
 * renewal and resume. All mutations are server-side via /api/customer/subscription
 * (canonical services), tenant-scoped and audited. Display only backends facts;
 * never fabricates a "changed" state before the backend confirms it.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard, EmptyState, Badge } from "@/components/marketing-admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog, type ConfirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";

interface EligiblePlan {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  features: unknown;
  maxProperties: number | null;
  maxUsers: number | null;
  maxBookings: number | null;
  storageGb: number | null;
  customerPrice: number | null;
  currency: string | null;
  custom: boolean;
}

interface Overview {
  subscription: {
    id: string;
    planId: string;
    planName: string | null;
    status: string;
    billingCycle: string;
    currentPeriodStart: unknown;
    currentPeriodEnd: unknown;
    trialEndsAt: unknown;
    cancelAtPeriodEnd: boolean;
    country: string;
    currency: string;
    unitAmount: number | null;
  } | null;
  plan: {
    maxProperties: number | null;
    maxUsers: number | null;
    maxBookings: number | null;
    storageGb: number | null;
    features: unknown;
  } | null;
  usage: { properties: number; teamCount: number };
  outstanding: { amount: number; currency: string | null };
  openRequest: {
    id: string;
    fromPlanId: string | null;
    toPlanId: string | null;
    billingCycle: string | null;
    createdAt: unknown;
    proposedSnapshot: unknown;
  } | null;
  history: {
    id: string;
    fromPlanId: string | null;
    toPlanId: string | null;
    status: string;
    createdAt: unknown;
    reviewedByEmail: string | null;
    rejectionReason: string | null;
  }[];
  invoices: {
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    dueAt: unknown;
    createdAt: unknown;
  }[];
  eligiblePlans: EligiblePlan[];
  isManager: boolean;
}

interface Preview {
  toPlanId: string;
  toPlanName: string;
  currency: string;
  currentUnitAmount: number | null;
  newUnitAmount: number | null;
  billingCycle: string;
  prorationDeltaMinor: number;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  trial: { label: "Trial", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300" },
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300" },
  past_due: { label: "Past due", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300" },
  grace: { label: "In grace", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300" },
  suspended: { label: "Suspended", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300" },
  expired: { label: "Expired", cls: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300" },
  paused: { label: "Paused", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300" },
};

const SWITCHABLE = ["trial", "active", "past_due", "grace", "paused"];

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function daysUntil(v: unknown): number | null {
  if (!v) return null;
  const t = Date.parse(v as string);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function limitLabel(key: string, value: number | null): string | null {
  if (value === null || value === undefined) return null;
  const names: Record<string, string> = { maxProperties: "Properties", maxUsers: "Team members", maxBookings: "Bookings", storageGb: "Storage (GB)" };
  return `${names[key] ?? key}: ${value}`;
}

export default function CustomerSubscriptionClient({ overview: initial }: { overview: Overview }) {
  const router = useRouter();
  const toast = useToast();
  const [overview, setOverview] = useState<Overview>(initial);
  const [busy, setBusy] = useState(false);
  const [reviewPlan, setReviewPlan] = useState<EligiblePlan | null>(null);
  const [cancelAction, setCancelAction] = useState<ConfirmAction | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/customer/subscription").catch(() => null);
    if (res?.ok) setOverview((await res.json()) as Overview);
  }, []);

  useEffect(() => {
    // Re-sync once after mount so stale server props never linger.
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sub = overview.subscription;
  const isSwitchable = sub ? SWITCHABLE.includes(sub.status) : false;

  const run = async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const res = await fetch("/api/customer/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Something went wrong");
        return false;
      }
      await refresh();
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const onCancelConfirm = async () => {
    setCancelAction(null);
    const ok = await run("cancel");
    if (ok) {
      toast.success("Cancellation scheduled — service stays active until your billing period ends.");
    }
  };

  const currentPriceMinor = sub?.unitAmount != null && sub.currency ? sub.unitAmount * 100 : null;

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <SectionCard
        title="Current subscription"
        action={
          sub ? (
            <span className={(STATUS_META[sub.status] ?? STATUS_META.active).cls + " inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"}>
              {STATUS_META[sub.status]?.label ?? sub.status}
            </span>
          ) : undefined
        }
      >
        {!sub ? (
          <EmptyState title="No subscription" body="No subscription is associated with this organization yet." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 text-sm">
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{sub.planName ?? "Plan"}</p>
              <p className="text-zinc-500">{sub.billingCycle} billing · {fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}</p>
              {sub.status === "trial" && sub.trialEndsAt != null && (
                <p className="text-sm text-sky-600 dark:text-sky-300">Trial ends {fmtDate(sub.trialEndsAt)}</p>
              )}
              {sub.cancelAtPeriodEnd && (
                <p className="text-sm text-rose-600 dark:text-rose-300">
                  Subscription is scheduled to cancel on {fmtDate(sub.currentPeriodEnd)}.
                </p>
              )}
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {currentPriceMinor != null && sub.currency ? formatMoney(currentPriceMinor, sub.currency) : "—"}
              </p>
            </div>
            <div className="space-y-2.5">
              {overview.outstanding.amount > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-semibold">Outstanding balance</p>
                  <p className="mt-0.5">{formatMoney(overview.outstanding.amount, overview.outstanding.currency)} outstanding. Renewal is blocked until it is settled.</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {overview.isManager && isSwitchable && !sub.cancelAtPeriodEnd && sub.status !== "paused" && (daysUntil(sub.currentPeriodEnd) ?? 0) < 0 && (
                  <button className={btnPrimaryCls} disabled={busy} onClick={() => void run("renew")}>
                    Renew now
                  </button>
                )}
                {overview.isManager && (sub.cancelAtPeriodEnd || sub.status === "paused") && (
                  <button className={btnPrimaryCls} disabled={busy} onClick={() => void run("resume")}>
                    Resume subscription
                  </button>
                )}
                {overview.isManager && isSwitchable && !sub.cancelAtPeriodEnd && (
                  <button
                    className={btnGhostCls}
                    disabled={busy}
                    onClick={() =>
                      setCancelAction({
                        title: "Cancel subscription",
                        message: `Your ${sub.planName ?? "plan"} will stay active until ${fmtDate(sub.currentPeriodEnd)}, then cancel at the end of the billing period.`,
                        consequences: [
                          "You keep access until the end of your current billing period.",
                          "No further charges after your current period ends.",
                          "Cancellation is scheduled — you can resume before the period ends.",
                        ],
                        confirmLabel: "Schedule cancellation",
                        tone: "danger",
                      })
                    }
                  >
                    Cancel subscription
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {overview.usage.properties + overview.usage.teamCount > 0 && sub && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Usage vs plan</p>
              <p className="mt-1">Properties {overview.usage.properties} / {sub.planId && overview.plan ? overview.plan.maxProperties ?? "∞" : "∞"}</p>
              <p>Team members {overview.usage.teamCount} / {overview.plan?.maxUsers ?? "∞"}</p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Pending request */}
      {overview.openRequest && (
        <SectionCard title="Pending plan-change request" subtitle="Waiting for our billing team to review and apply.">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              Change from <strong>{overview.openRequest.fromPlanId ?? "—"}</strong> to{" "}
              <strong>{overview.openRequest.toPlanId ?? "—"}</strong>
              {overview.openRequest.billingCycle ? ` (${overview.openRequest.billingCycle})` : ""}{" "}
              · requested {fmtDate(overview.openRequest.createdAt)}
            </p>
            {overview.isManager && (
              <button className={btnGhostCls} disabled={busy} onClick={() => void withdraw(overview.openRequest!.id, toast, refresh)}>
                Withdraw request
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* Plan comparison */}
      <SectionCard
        title="Change your plan"
        subtitle={
          overview.isManager
            ? "Compare plans and request a change. Pricing and proration are computed by our billing system at approval."
            : "Only a billing or owner contact can request plan changes."
        }
      >
        {!isSwitchable || !overview.isManager ? (
          <EmptyState
            title={!overview.isManager ? "Read-only view" : `Not available while ${sub?.status ?? "this state"}`}
            body={
              !overview.isManager
                ? "Ask a billing or owner contact on your team to manage the subscription."
                : "Plan changes can't be requested while a subscription is suspended, cancelled, or expired."
            }
          />
        ) : overview.eligiblePlans.length === 0 ? (
          <EmptyState title="No alternate plans" body="No other plans are available in your region right now." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.eligiblePlans.map((p) => {
              const limitOverProperties = p.maxProperties != null && overview.usage.properties > p.maxProperties;
              const limitOverUsers = p.maxUsers != null && overview.usage.teamCount > p.maxUsers;
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-line bg-surface-subtle p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</p>
                      {p.tagline && <p className="text-xs text-zinc-500">{p.tagline}</p>}
                    </div>
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {p.customerPrice != null && p.currency ? formatMoney(p.customerPrice * 100, p.currency) : "Contact sales"}
                      <span className="text-xs font-medium text-zinc-400">/{sub?.billingCycle ?? "mo"}</span>
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {[["maxProperties", p.maxProperties] as const, ["maxUsers", p.maxUsers] as const].map(([k, v]) => {
                      const lb = limitLabel(k, v);
                      return lb ? <li key={k}>{lb}</li> : null;
                    })}
                  </ul>
                  {(limitOverProperties || limitOverUsers) && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      You currently exceed this plan&apos;s limits — downgrades may be reviewed carefully.
                    </p>
                  )}
                  <button className={btnPrimaryCls + " mt-3 w-full"} disabled={busy} onClick={() => setReviewPlan(p)}>
                    Change plan
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Request history */}
      {overview.history.length > 0 && (
        <SectionCard title="Request history">
          <ul className="divide-y divide-line text-sm">
            {overview.history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <strong>{r.fromPlanId ?? "—"}</strong> → <strong>{r.toPlanId ?? "—"}</strong>
                  <span className="text-zinc-400"> · {fmtDate(r.createdAt)}</span>
                  {r.rejectionReason && <span className="block text-xs text-rose-500">Rejected: {r.rejectionReason}</span>}
                </span>
                <Badge>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Invoices */}
      {overview.invoices.length > 0 && (
        <SectionCard title="Recent invoices">
          <ul className="divide-y divide-line text-sm">
            {overview.invoices.slice(0, 10).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="capitalize text-zinc-500">{inv.type}</span>
                  <StatusBadge domain="invoice" status={inv.status} />
                  <span className="text-xs text-zinc-400">{fmtDate(inv.createdAt)}</span>
                </span>
                <span className="tabular-nums">{formatMoney(inv.amount, inv.currency)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <ReviewModal
        plan={reviewPlan}
        currentPlanName={sub?.planName ?? null}
        billingCycle={(sub?.billingCycle as "monthly" | "yearly") ?? "monthly"}
        usage={overview.usage}
        subscriptionId={sub?.id ?? ""}
        onClose={() => setReviewPlan(null)}
        onSubmitted={(ok, msg) => {
          if (ok) {
            toast.success(msg);
            void refresh();
            router.refresh();
          } else {
            toast.error(msg);
          }
        }}
      />

      <ConfirmDialog action={cancelAction} onClose={() => setCancelAction(null)} onConfirm={() => void onCancelConfirm()} busy={busy} />
    </div>
  );
}

async function withdraw(id: string, toast: ReturnType<typeof useToast>, refresh: () => Promise<void>) {
  const res = await fetch(`/api/customer/subscription/change/${id}`, { method: "DELETE" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(d.error ?? "Could not withdraw");
    return;
  }
  toast.success("Request withdrawn");
  await refresh();
}

const btnPrimaryCls =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhostCls =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-surface-subtle dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60";

function ReviewModal({
  plan,
  currentPlanName,
  billingCycle,
  usage,
  subscriptionId,
  onClose,
  onSubmitted,
}: {
  plan: EligiblePlan | null;
  currentPlanName: string | null;
  billingCycle: "monthly" | "yearly";
  usage: { properties: number; teamCount: number };
  subscriptionId: string;
  onClose: () => void;
  onSubmitted: (ok: boolean, msg: string) => void;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">(billingCycle);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setError(null);
    if (!plan || !subscriptionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/customer/subscription", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toPlanId: plan.id, billingCycle: cycle }),
        });
        const d = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setError(d.error ?? "Could not compute price");
        else setPreview(d.preview as Preview);
      } catch {
        if (alive) setError("Could not compute price");
      }
    })();
    return () => {
      alive = false;
    };
  }, [plan?.id, cycle, subscriptionId, plan]);

  if (!plan) return null;

  const overProps = plan.maxProperties != null && usage.properties > plan.maxProperties;
  const overUsers = plan.maxUsers != null && usage.teamCount > plan.maxUsers;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/customer/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change", toPlanId: plan.id, billingCycle: cycle }),
      });
      const d = await res.json().catch(() => ({}));
      onSubmitted(res.ok, res.ok ? "Plan-change request submitted for review." : (d.error ?? "Could not submit"));
      if (res.ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{plan.name}</h2>
            <p className="text-sm text-zinc-500">
              {currentPlanName ?? "Current plan"} → {plan.name}
            </p>
          </div>
          <button aria-label="Close" className={btnGhostCls + " h-8 w-8 !p-0"} onClick={onClose}>✕</button>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Billing cycle</label>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              className={
                "rounded-xl border px-3 py-2 text-sm font-medium capitalize " +
                (cycle === c ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "border-line bg-surface text-zinc-600")
              }
              onClick={() => setCycle(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : !preview ? (
          <p className="text-sm text-zinc-500">Computing price…</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="tabular-nums">
              New rate: <strong>{formatMoney((preview.newUnitAmount ?? 0) * 100, preview.currency)}</strong>/{preview.billingCycle}
            </p>
            <p className="tabular-nums">
              Prorated adjustment for this period:{" "}
              <strong>{preview.prorationDeltaMinor !== 0 ? formatMoney(preview.prorationDeltaMinor, preview.currency, { signed: true }) : "None"}</strong>
            </p>
            {overProps || overUsers ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Your current usage exceeds this plan&apos;s limits ({overProps ? `${usage.properties} properties` : ""}
                {overProps && overUsers ? ", " : ""}
                {overUsers ? `${usage.teamCount} team members` : ""}). The change may be reviewed before it is applied.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className={btnGhostCls} onClick={onClose}>Cancel</button>
          <button className={btnPrimaryCls} disabled={busy || !!error || !preview} onClick={() => void submit()}>
            {busy ? "Submitting…" : "Request change"}
          </button>
        </div>
      </div>
    </div>
  );
}
