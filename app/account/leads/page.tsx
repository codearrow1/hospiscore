import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import LeadStatusControl from "@/components/LeadStatusControl";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin, listLeads, propertyUrl, type LeadRow } from "@/lib/leads";
import {
  isLeadStatus,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_STYLES,
  type LeadStatus,
} from "@/lib/accountTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Sales leads · HospiScore",
  description: "Demo bookings and score-report captures for the sales team.",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function badge(row: LeadRow) {
  return row.source === "demo" ? (
    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
      Demo
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
      Report
    </span>
  );
}

function LeadRowView({ row }: { row: LeadRow }) {
  const property = row.propertyName
    ? row.propertySlug
      ? (() => {
          const url = propertyUrl(row.propertySlug);
          return (
            <Link href={url} className="text-indigo-600 hover:underline dark:text-indigo-400">
              {row.propertyName}
            </Link>
          );
        })()
      : row.propertyName
    : null;

  const detail =
    row.source === "demo"
      ? [row.company && `${row.company}`, row.propertyCount && `${row.propertyCount} properties`]
          .filter(Boolean)
          .join(" · ")
      : row.propertySlug?.replace(/^place:/, "");

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{row.name}</span>
            {badge(row)}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEAD_STATUS_STYLES[row.status]}`}
            >
              {LEAD_STATUS_LABELS[row.status]}
            </span>
          </div>
          <a
            href={`mailto:${row.email}`}
            className="text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            {row.email}
          </a>
          {row.phone && (
            <a
              href={`tel:${row.phone.replace(/[^\d+]/g, "")}`}
              className="mt-0.5 block text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              {row.phone}
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right text-xs text-zinc-400">{fmtDate(row.createdAt)}</div>
          <LeadStatusControl leadId={row.id} status={row.status} />
        </div>
      </div>
      {(property || detail) && (
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {property}
          {property && detail && <span className="text-zinc-400"> · </span>}
          {detail}
        </div>
      )}
      {row.message && (
        <p className="mt-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-300">
          {row.message}
        </p>
      )}
    </li>
  );
}

function FilterChip({
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
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center rounded-full px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </Link>
  );
}

function LeadSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: LeadRow[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {empty}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <LeadRowView key={r.id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

type SourceFilter = "all" | "demo" | "report";
type StatusFilter = LeadStatus | "all";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; status?: string }>;
}) {
  const { source, status } = await searchParams;
  const sourceFilter: SourceFilter =
    source === "demo" || source === "report" ? source : "all";
  const statusFilter: StatusFilter = isLeadStatus(status) ? status : "all";

  function filterHref(s: SourceFilter, st: StatusFilter): string {
    const params = new URLSearchParams();
    if (s !== "all") params.set("source", s);
    if (st !== "all") params.set("status", st);
    const qs = params.toString();
    return qs ? `/account/leads?${qs}` : "/account/leads";
  }

  function exportHref(): string {
    const params = new URLSearchParams();
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `/api/leads/export?${qs}` : "/api/leads/export";
  }

  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/account/leads");

  if (!isAdmin(user)) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sales leads
          </h1>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              This area is restricted to the HospiOS team. If you should have
              access, sign in with an admin account or ask an administrator to
              add your e-mail to <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">ADMIN_EMAILS</code>.
            </p>
          </div>
        </main>
        <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          HospiScore · Hospitality OS
        </footer>
      </div>
    );
  }

  const leads = await listLeads();

  const demoRows =
    sourceFilter === "report"
      ? []
      : leads.demo.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const reportRows =
    sourceFilter === "demo"
      ? []
      : leads.report.filter((r) => statusFilter === "all" || r.status === statusFilter);
  const filteredTotal = demoRows.length + reportRows.length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to account
        </Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sales leads
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Demo bookings and score-report captures. Update a lead&apos;s status
              as the team works it.
            </p>
          </div>
          <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {filteredTotal} of {leads.total} shown
          </span>
          <Link
            href={exportHref()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
            </svg>
            Export CSV
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Source
            </span>
            <FilterChip href={filterHref("all", statusFilter)} label="All" active={sourceFilter === "all"} />
            <FilterChip href={filterHref("demo", statusFilter)} label="Demo" active={sourceFilter === "demo"} />
            <FilterChip href={filterHref("report", statusFilter)} label="Report" active={sourceFilter === "report"} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Status
            </span>
            <FilterChip href={filterHref(sourceFilter, "all")} label="All" active={statusFilter === "all"} />
            {LEAD_STATUSES.map((s) => (
              <FilterChip
                key={s}
                href={filterHref(sourceFilter, s)}
                label={LEAD_STATUS_LABELS[s]}
                active={statusFilter === s}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <LeadSection
            title="Demo bookings"
            rows={demoRows}
            empty="No demo requests match these filters. Clear the filters or wait for new submissions."
          />
          <LeadSection
            title="Score report captures"
            rows={reportRows}
            empty="No score-report captures match these filters. Clear the filters or wait for new requests."
          />
        </div>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiScore · Hospitality OS
      </footer>
    </div>
  );
}
