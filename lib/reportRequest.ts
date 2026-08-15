import { randomUUID } from "node:crypto";
import { writeData } from "@/lib/db";
import type { LeadStatus } from "@/lib/accountTypes";

/**
 * Score-report email requests (server-only).
 *
 * Visitors can ask for the full score report of a property to be emailed to
 * them. Each request is stored in the shared account data file (`lib/db.ts`)
 * as a sales lead, mirroring the demo-booking flow.
 */

export interface ReportRequest {
  id: string;
  name: string;
  email: string;
  propertySlug: string;
  propertyName: string;
  /** Sales-funnel status; absent on older records → treated as "new". */
  status?: LeadStatus;
  createdAt: string;
}

export interface ReportRequestInput {
  name: string;
  email: string;
  propertySlug: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReportValidation = { ok: true } | { ok: false; error: string };

export function validateReportInput(input: Partial<ReportRequestInput>): ReportValidation {
  const name = (input.name ?? "").toString().trim();
  const email = (input.email ?? "").toString().trim();
  const slug = (input.propertySlug ?? "").toString().trim();
  if (!name) return { ok: false, error: "Name is required" };
  if (!email) return { ok: false, error: "Email is required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address" };
  if (!slug) return { ok: false, error: "A property is required" };
  return { ok: true };
}

/** Persist a validated report request and return the stored record. */
export async function submitReportRequest(
  input: Partial<ReportRequestInput>,
  propertyName: string,
  target?: string,
): Promise<ReportRequest> {
  const check = validateReportInput(input);
  if (!check.ok) throw new Error(check.error);

  const record: ReportRequest = {
    id: randomUUID(),
    name: input.name!.trim(),
    email: input.email!.trim().toLowerCase(),
    propertySlug: input.propertySlug!.trim(),
    propertyName: propertyName.trim(),
    createdAt: new Date().toISOString(),
  };

  await writeData(
    (d) => ({
      ...d,
      reportRequests: [...d.reportRequests, record],
    }),
    target,
  );
  return record;
}
