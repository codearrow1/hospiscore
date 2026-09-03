"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { DetailDrawer, DrawerSection, KeyValue } from "@/components/ui/DetailDrawer";
import { formatMoney, formatDateTime, formatRelative } from "@/lib/format";

export type DunningCaseView = {
  id: string; orgId: string; orgName: string; orgCountry: string | null;
  invoiceId: string; invoiceAmountCents: number | null; invoiceCurrency: string | null; invoiceStatus: string | null;
  attempt: number; maxAttempts: number;
  nextRetryAt: string | null; lastError: string | null;
  status: string; createdAt: string; updatedAt: string;
};

const STAGES = [
  { value: "", label: "All" },
  { value: "active", label: "Collecting" },
  { value: "recovered", label: "Recovered" },
  { value: "suspended", label: "Paused" },
  { value: "given_up", label: "Given up" },
];

/** Retry ladder: contacts at +1d/+3d/+5d/+7d after each failed attempt. */
const LADDER_DAYS = [1, 3, 5, 7];

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function DunningManager({ cases, counts, currentStatus, aging }: {
  cases: DunningCaseView[];
  counts: Record<string, number>;
  currentStatus: string;
  aging: { label: string; min: number; max: number; count: number }[];
}) {
  const [detail, setDetail] = useState<DunningCaseView | null>(null);

  const stageHref = (value: string) => (value ? `/saas/dunning?status=${value}` : "/saas/dunning");
  const totalActive = counts["active"] ?? 0;
  const worstBucket = useMemo(() => aging.reduce((worst, b) => (b.count > 0 ? b : worst), aging[0]), [aging]);

  return (
    <div className="space-y-4">
      {/* Aging strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className={`rounded-2xl border p-4 ${totalActive > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Open collections</p>
          <p className="mt-1.5 text-lg font-bold tabular-nums">{totalActive}</p>
          <p className="mt-1 text-xs text-zinc-400">{counts["recovered"] ?? 0} recovered · {counts["given_up"] ?? 0} given up</p>
        </div>
        {aging.map((b) => (
          <div key={b.label}
            className={`rounded-2xl border p-4 ${
              b === worstBucket && b.count > 0 && b.min >= 15
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Aging {b.label}</p>
            <p className="mt-1.5 text-lg font-bold tabular-nums">{b.count}</p>
            <p className="mt-1 text-xs text-zinc-400">{b.label === "30d+" ? "escalation risk" : "active case(s)"}</p>
          </div>
        ))}
      </div>

      {/* Stage filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STAGES.map((s) => (
          <Link key={s.value} href={stageHref(s.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              currentStatus === s.value
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}>
            {s.label}{s.value && ` (${counts[s.value] ?? 0})`}
            {!s.value && ` (${Object.values(counts).reduce((a, v) => a + v, 0)})`}
          </Link>
        ))}
      </div>

      {/* Cases table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-zinc-400">
            <th className="px-3 py-2">Customer</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Attempts</th>
            <th className="px-3 py-2">Next action</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Last error</th>
          </tr></thead>
          <tbody>
            {cases.map((c) => {
              const overdueRetry = c.nextRetryAt && c.status === "active" && new Date(c.nextRetryAt).getTime() < Date.now();
              const age = ageDays(c.createdAt);
              return (
                <tr key={c.id} onClick={() => setDetail(c)}
                  className={`cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 ${
                    overdueRetry ? "bg-red-50/50 dark:bg-red-950/10" : ""
                  }`}>
                  <td className="px-3 py-2"><Link href={`/saas/organizations/${c.orgId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{c.orgName}</Link>{c.orgCountry && <span className="ml-1 rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800">{c.orgCountry}</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.invoiceAmountCents != null && c.invoiceCurrency ? (
                      <>
                        <span className="font-semibold tabular-nums">{formatMoney(c.invoiceAmountCents, c.invoiceCurrency)}</span>
                        {c.invoiceStatus && <span className="block"><StatusBadge domain="invoice" status={c.invoiceStatus} /></span>}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">{c.attempt} / {c.maxAttempts}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.status === "recovered" ? <span className="text-emerald-600 dark:text-emerald-400">settled — case closed</span>
                      : c.status === "given_up" ? <span className="text-red-600 dark:text-red-400">ladder exhausted</span>
                      : c.status === "suspended" ? <span>paused</span>
                      : c.nextRetryAt ? <span className={overdueRetry ? "font-semibold text-red-600 dark:text-red-400" : ""}>{overdueRetry ? "retry due now" : `retry ${formatRelative(c.nextRetryAt)}`}</span>
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">{age}d</td>
                  <td className="px-3 py-2"><StatusBadge domain="dunning" status={c.status} /></td>
                  <td className="max-w-40 truncate px-3 py-2 text-xs text-zinc-500" title={c.lastError ?? undefined}>{c.lastError ?? "—"}</td>
                </tr>
              );
            })}
            {cases.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-zinc-400">No dunning cases{currentStatus ? " in this stage" : ""}. Failed payments open cases automatically.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Case drawer with retry ladder timeline */}
      <DetailDrawer open={detail !== null} onClose={() => setDetail(null)} title={`Case ${detail?.id.slice(0, 12)}…`} subtitle={detail?.orgName} width="lg">
        {detail && (
          <div className="space-y-4">
            <DrawerSection title="Case details">
              <KeyValue label="Customer"><Link href={`/saas/organizations/${detail.orgId}`} className="text-blue-600 hover:underline dark:text-blue-400">{detail.orgName}</Link></KeyValue>
              <KeyValue label="Stage"><StatusBadge domain="dunning" status={detail.status} /></KeyValue>
              <KeyValue label="Invoice amount">{detail.invoiceAmountCents != null && detail.invoiceCurrency ? formatMoney(detail.invoiceAmountCents, detail.invoiceCurrency) : "—"}</KeyValue>
              <KeyValue label="Invoice status">{detail.invoiceStatus ? <StatusBadge domain="invoice" status={detail.invoiceStatus} /> : "—"}</KeyValue>
              <KeyValue label="Opened">{formatDateTime(detail.createdAt)} ({ageDays(detail.createdAt)}d ago)</KeyValue>
              <KeyValue label="Last activity">{formatDateTime(detail.updatedAt)}</KeyValue>
              {detail.lastError && <KeyValue label="Last error"><span className="text-red-600 dark:text-red-400">{detail.lastError}</span></KeyValue>}
            </DrawerSection>

            <DrawerSection title="Recovery timeline">
              {detail.status === "recovered" ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Recovered — the invoice reached full settlement and the subscription was reactivated.
                </p>
              ) : detail.status === "given_up" ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  Retry ladder exhausted after {detail.maxAttempts} attempts — the subscription was suspended.
                </p>
              ) : (
                <ol className="space-y-2">
                  {LADDER_DAYS.map((day, i) => {
                    const attemptNo = i + 1;
                    const done = detail.attempt >= attemptNo;
                    const isNext = detail.status === "active" && detail.attempt === i;
                    return (
                      <li key={day} className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          done ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                          : isNext ? "bg-amber-400 text-zinc-900"
                          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                        }`}>{done ? "✓" : attemptNo}</span>
                        <div className="text-sm">
                          <p className={done ? "text-zinc-400 line-through" : isNext ? "font-semibold" : "text-zinc-400"}>
                            Attempt {attemptNo}{isNext && detail.nextRetryAt ? ` — scheduled ${formatDateTime(detail.nextRetryAt)}` : ""}
                          </p>
                          <p className="text-xs text-zinc-400">retry scheduled +{day}d after the failed attempt</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </DrawerSection>

            <p className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-400 dark:bg-zinc-800/50">
              Recovery is automatic: recording a succeeded payment that fully settles the invoice closes the case and restores service.
              Manual case edits are intentionally not exposed — the retry ladder and settlement hooks own this state machine (see lib/saas/dunning.ts).
            </p>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
