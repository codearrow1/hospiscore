import { readData, writeData } from "@/lib/db";
import { CONFIG } from "@/lib/config";
import type { AuthUser } from "@/lib/auth";
import type { DemoRequest } from "@/lib/demo";
import type { ReportRequest } from "@/lib/reportRequest";
import { isLeadStatus, type LeadStatus } from "@/lib/accountTypes";
import { roleFor } from "@/lib/marketing/roles";

/**
 * Internal sales-leads view (server-only).
 *
 * Demo bookings and score-report e-mail captures are separate arrays in the
 * shared data document. This module unifies them into rows the `/account/leads`
 * page renders, and gates access to admin e-mails configured via `ADMIN_EMAILS`
 * or a marketing role (see lib/marketing/roles).
 */

/** Whether a user is allowed to see the internal leads view. */
export function isAdmin(
  user: Pick<AuthUser, "email" | "role">,
  allowed: readonly string[] = CONFIG.adminEmails,
): boolean {
  return roleFor(user, allowed) !== null || allowed.includes(user.email.toLowerCase());
}

export interface LeadRow {
  id: string;
  source: "demo" | "report";
  name: string;
  email: string;
  phone?: string;
  propertyName?: string;
  propertySlug?: string;
  company?: string;
  propertyCount?: number;
  message?: string;
  /** Pricing context captured with demo requests. */
  plan?: string;
  country?: string;
  billingCycle?: "monthly" | "yearly";
  status: LeadStatus;
  createdAt: string;
}

export interface LeadsSnapshot {
  total: number;
  demo: LeadRow[];
  report: LeadRow[];
}

function demoRow(r: DemoRequest): LeadRow {
  return {
    id: r.id,
    source: "demo",
    name: r.name,
    email: r.email,
    company: r.company,
    propertyName: r.propertyName,
    propertyCount: r.propertyCount,
    plan: r.plan,
    country: r.country,
    billingCycle: r.billingCycle,
    message: r.message,
    status: r.status ?? "new",
    createdAt: r.createdAt,
  };
}

function reportRow(r: ReportRequest): LeadRow {
  return {
    id: r.id,
    source: "report",
    name: r.name,
    email: r.email,
    phone: r.phone,
    propertyName: r.propertyName,
    propertySlug: r.propertySlug,
    status: r.status ?? "new",
    createdAt: r.createdAt,
  };
}

/** Load and merge all captured leads. `target` overrides the file for tests. */
export async function listLeads(target?: string): Promise<LeadsSnapshot> {
  const data = await readData(target);
  const demo = data.demoRequests.map(demoRow);
  const report = data.reportRequests.map(reportRow);
  return {
    total: demo.length + report.length,
    demo,
    report,
  };
}

/**
 * Set the sales status of a lead (demo or report) by id. Returns the updated
 * row, or null when no lead matches. Throws on an invalid status.
 */
export async function setLeadStatus(
  id: string,
  status: LeadStatus,
  target?: string,
): Promise<LeadRow | null> {
  if (!isLeadStatus(status)) throw new Error("Invalid lead status");

  let touched = false;
  await writeData(
    (d) => {
      const demo = d.demoRequests.map((r) => (r.id === id ? { ...r, status } : r));
      const report = d.reportRequests.map((r) => (r.id === id ? { ...r, status } : r));
      touched =
        d.demoRequests.some((r) => r.id === id) ||
        d.reportRequests.some((r) => r.id === id);
      if (!touched) return d;
      return { ...d, demoRequests: demo, reportRequests: report };
    },
    target,
  );

  if (!touched) return null;
  const snap = await listLeads(target);
  return [...snap.demo, ...snap.report].find((r) => r.id === id) ?? null;
}

/** Public report URL for a lead's property (live place slugs share a route). */
export function propertyUrl(slug: string): string {
  return slug.startsWith("place:")
    ? `/property/${encodeURIComponent(slug)}`
    : `/properties/${encodeURIComponent(slug)}`;
}

export type LeadSourceFilter = "all" | "demo" | "report";
export type LeadStatusFilter = LeadStatus | "all";

/** Apply the same source/status filters the leads page uses. */
export function filterLeads(
  snapshot: LeadsSnapshot,
  source: LeadSourceFilter,
  status: LeadStatusFilter,
): { demo: LeadRow[]; report: LeadRow[] } {
  const match = (r: LeadRow) => status === "all" || r.status === status;
  return {
    demo: source === "report" ? [] : snapshot.demo.filter(match),
    report: source === "demo" ? [] : snapshot.report.filter(match),
  };
}

const CSV_HEADERS = [
  "source",
  "status",
  "name",
  "email",
  "phone",
  "propertyName",
  "propertySlug",
  "company",
  "propertyCount",
  "plan",
  "country",
  "billingCycle",
  "message",
  "createdAt",
] as const;

function escCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}

/**
 * Serialize leads to CSV (Excel-friendly: \r\n rows + a UTF-8 BOM so accented
 * names decode correctly when opened in Excel).
 */
export function leadsToCsv(rows: LeadRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.source,
        r.status,
        r.name,
        r.email,
        r.phone ?? null,
        r.propertyName ?? null,
        r.propertySlug ?? null,
        r.company ?? null,
        r.propertyCount ?? null,
        r.plan ?? null,
        r.country ?? null,
        r.billingCycle ?? null,
        r.message ?? null,
        r.createdAt,
      ]
        .map(escCsv)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
