"use client";

import type { ReactNode } from "react";
import type { ReportPoint, MarketView } from "@/lib/report";

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function AlertIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.335-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92ZM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-5a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PrintIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2v4H4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4Zm3 0h4v1h-4V4H8Zm0 7h4v4H8v-4Zm-2-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  );
}

function TargetIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-13.93A6.08 6.08 0 0 1 15.93 9H13a3 3 0 0 0-3-3V4.07ZM7.05 16.3A6.08 6.08 0 0 1 4.07 9H7a3 3 0 0 1 3 3v3a3 3 0 0 1-2.95.3ZM10 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
    </svg>
  );
}

function UsersIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM17 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM12.93 18c.21-.62.07-1.59.07-2a6 6 0 0 0-10.5-4H3a6 6 0 0 0 9.93 6ZM19 16a6 6 0 0 0-8.05-5.61A7 7 0 0 1 12.4 18H18a1 1 0 0 0 1-1v-1Z" />
    </svg>
  );
}

function TrendIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M1 10a1 1 0 0 1 1-1h12.59l-3.3-3.29a1 1 0 1 1 1.42-1.42l5 5a1 1 0 0 1 0 1.42l-5 5a1 1 0 0 1-1.42-1.42L14.59 11H2a1 1 0 0 1-1-1Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a1 1 0 0 1 .95.68l1.2 3.6 3.6 1.2a1 1 0 0 1 0 1.9l-3.6 1.2-1.2 3.6A1 1 0 0 1 10 15a1 1 0 0 1-.95-.68l-1.2-3.6-3.6-1.2a1 1 0 0 1 0-1.9l3.6-1.2 1.2-3.6A1 1 0 0 1 10 2Zm5.5 10.5a.75.75 0 0 1 .71.51l.37 1.1 1.1.37a.75.75 0 0 1 0 1.42l-1.1.37-.37 1.1a.75.75 0 0 1-1.42 0l-.37-1.1-1.1-.37a.75.75 0 0 1 0-1.42l1.1-.37.37-1.1a.75.75 0 0 1 .71-.51Z" />
    </svg>
  );
}

function Bar({ value, tone }: { value: number; tone: "good" | "bad" }) {
  return (
    <div
      aria-hidden="true"
      className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10"
    >
      <div
        className={`h-full rounded-full ${
          tone === "good"
            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
            : "bg-gradient-to-r from-rose-500 to-rose-400"
        }`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function Item({ point, tone }: { point: ReportPoint; tone: "good" | "bad" }) {
  const iconWrapClass =
    tone === "good"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  const pillClass =
    tone === "good"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
      : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200";

  return (
    <li className="flex gap-3 rounded-xl p-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}>
        {tone === "good" ? <CheckIcon /> : <AlertIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {point.title}
          </span>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ${pillClass}`}>
            {point.score}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {point.body}
        </p>
        <div className="mt-2">
          <Bar value={point.score} tone={tone} />
        </div>
      </div>
    </li>
  );
}

function ReportPanel({
  heading,
  tone,
  intro,
  groups,
}: {
  heading: string;
  tone: "good" | "bad";
  intro: string;
  groups: { label: string; points: ReportPoint[] }[];
}) {
  const accentPanel =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/10"
      : "border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10";
  const accentText =
    tone === "good"
      ? "text-emerald-800 dark:text-emerald-300"
      : "text-rose-800 dark:text-rose-300";
  const iconWrap =
    tone === "good"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  const countPill =
    tone === "good"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
      : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200";

  const visible = groups.filter((g) => g.points.length > 0);
  const total = visible.reduce((sum, g) => sum + g.points.length, 0);

  return (
    <section
      className={`flex flex-col rounded-2xl border p-5 shadow-sm ${accentPanel}`}
      aria-label={heading}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2.5 text-sm font-bold uppercase tracking-wide">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
            {tone === "good" ? <CheckIcon /> : <AlertIcon />}
          </span>
          <span className={`truncate ${accentText}`}>{heading}</span>
        </h3>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${countPill}`}>
          {total}
        </span>
      </div>

      <p className="mb-4 mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
        {intro}
      </p>

      {visible.length === 0 && (
        <div className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
          tone === "good"
            ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
            : "bg-rose-100/60 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200"
        }`}>
          {tone === "good"
            ? "No standout strengths on record yet."
            : "Nothing below the healthy bar right now — keep it that way."}
        </div>
      )}

      {visible.map((g, idx) => (
        <div
          key={g.label}
          className={idx > 0 ? "mt-4 border-t border-zinc-900/10 pt-4 dark:border-white/10" : ""}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {g.label}
            </h4>
            <span className="text-[11px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">
              {g.points.length}
            </span>
          </div>
          <ul className="-mx-2.5 flex flex-col">
            {g.points.map((p) => (
              <Item key={p.key} point={p} tone={tone} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function StatCard({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700/70 dark:bg-zinc-800/50">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {icon}
        </span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function PropertyReport({
  propertyName,
  headline,
  strengths,
  watchouts,
  risks,
  servicesPositive,
  servicesNegative,
  platformsCount,
  totalReviews,
  market,
  trend,
}: {
  propertyName: string;
  headline: string;
  strengths: ReportPoint[];
  watchouts: ReportPoint[];
  risks: ReportPoint[];
  servicesPositive: ReportPoint[];
  servicesNegative: ReportPoint[];
  platformsCount: number;
  totalReviews: number;
  market: MarketView;
  trend?: { change: number; points: number; latest: number };
}) {
  const marketLabel =
    market.overallDelta > 0
      ? `${Math.abs(market.overallDelta)} pts above the ${market.peerCount}-property average`
      : market.overallDelta < 0
        ? `${Math.abs(market.overallDelta)} pts below the ${market.peerCount}-property average`
        : "on par with the property average";

  return (
    <div className="report flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Detailed property report
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Generated for <span className="font-semibold text-zinc-700 dark:text-zinc-200">{propertyName}</span> ·{" "}
            {platformsCount} platforms · {totalReviews.toLocaleString("en-US")} reviews
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          <PrintIcon />
          Print report
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 dark:border-indigo-500/25 dark:from-indigo-500/15 dark:via-zinc-900 dark:to-violet-500/10">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <SparkleIcon />
          </span>
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">{headline}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<TargetIcon />} label="Market position">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{marketLabel}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            beats {market.rankPosition} of {market.peerCount} peers ·{" "}
            {market.aboveAverage}/{market.aboveAverage + market.belowAverage} criteria above average
          </div>
        </StatCard>
        <StatCard icon={<UsersIcon />} label="Peer benchmark">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {market.peerAverage}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              avg · best {market.peerBest}
            </span>
          </div>
        </StatCard>
        <StatCard icon={<TrendIcon />} label="Score trend">
          {trend ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  trend.change >= 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                }`}
              >
                {trend.change >= 0 ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06l-4.25-4.25a.75.75 0 0 0-1.06 0L5.22 13.72a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  trend.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {trend.change >= 0 ? "+" : ""}
                {trend.change}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                pts across {trend.points} snapshots (now {trend.latest})
              </span>
            </div>
          ) : (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              History builds up as the daily worker runs.
            </div>
          )}
        </StatCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportPanel
          heading="What's working well"
          tone="good"
          intro="Signals that lend the property credibility — plus the services guests praise most."
          groups={[
            { label: "Top strengths", points: strengths },
            { label: "Well-reviewed services", points: servicesPositive },
          ]}
        />
        <ReportPanel
          heading="Where attention goes"
          tone="bad"
          intro="The signals and services holding the overall score back — fix these first."
          groups={[
            { label: "Critical", points: risks },
            { label: "To watch", points: watchouts },
            { label: "Service gaps", points: servicesNegative },
          ]}
        />
      </div>
    </div>
  );
}