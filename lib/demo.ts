import { randomUUID } from "node:crypto";
import { writeData } from "@/lib/db";
import type { LeadStatus } from "@/lib/accountTypes";
import { PLAN_IDS } from "@/lib/pricing/catalog";
import type { PlanId } from "@/lib/pricing/types";

/**
 * Demo-booking requests (server-only).
 *
 * Stored in the shared account data file (`lib/db.ts`) so sales/owner teams can
 * follow up. Validation lives here so the API route and any future UI share it.
 */

export interface DemoRequest {
  id: string;
  name: string;
  email: string;
  company?: string;
  propertyName?: string;
  propertyCount?: number;
  message?: string;
  /** Plan selected on the pricing page (display context for the sales call). */
  plan?: PlanId;
  /** Billing country selected by the visitor (sales context only; the
   *  authoritative price is agreed during the commercial conversation). */
  country?: string;
  /** Billing cycle selected on the pricing page. */
  billingCycle?: "monthly" | "yearly";
  /** Sales-funnel status; absent on older records → treated as "new". */
  status?: LeadStatus;
  createdAt: string;
}

export interface DemoRequestInput {
  name: string;
  email: string;
  company?: string;
  propertyName?: string;
  propertyCount?: number;
  message?: string;
  plan?: string;
  country?: string;
  billingCycle?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DemoValidation = { ok: true } | { ok: false; error: string };

export function validateDemoInput(input: Partial<DemoRequestInput>): DemoValidation {
  const name = (input.name ?? "").toString().trim();
  const email = (input.email ?? "").toString().trim();
  if (!name) return { ok: false, error: "Name is required" };
  if (!email) return { ok: false, error: "Email is required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address" };
  const count = input.propertyCount;
  if (count != null && (typeof count !== "number" || count < 1 || count > 5000)) {
    return { ok: false, error: "Property count must be between 1 and 5000" };
  }
  if (input.plan != null && input.plan !== "" && !(PLAN_IDS as readonly string[]).includes(input.plan)) {
    return { ok: false, error: "Unknown plan" };
  }
  if (input.country != null && input.country !== "" && !/^[A-Z]{2}$/.test(input.country)) {
    return { ok: false, error: "Country must be a 2-letter code" };
  }
  if (input.billingCycle != null && input.billingCycle !== "" && !["monthly", "yearly"].includes(input.billingCycle)) {
    return { ok: false, error: "Unknown billing cycle" };
  }
  return { ok: true };
}

/** Persist a validated demo request and return the stored record. */
export async function submitDemoRequest(
  input: Partial<DemoRequestInput>,
  target?: string,
): Promise<DemoRequest> {
  const check = validateDemoInput(input);
  if (!check.ok) throw new Error(check.error);

  const record: DemoRequest = {
    id: randomUUID(),
    name: input.name!.trim(),
    email: input.email!.trim().toLowerCase(),
    company: input.company?.trim() || undefined,
    propertyName: input.propertyName?.trim() || undefined,
    propertyCount: input.propertyCount,
    plan: (input.plan as PlanId | undefined) || undefined,
    country: input.country?.trim().toUpperCase() || undefined,
    billingCycle:
      input.billingCycle === "monthly" || input.billingCycle === "yearly"
        ? input.billingCycle
        : undefined,
    message: input.message?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  await writeData(
    (d) => ({
      ...d,
      demoRequests: [...d.demoRequests, record],
    }),
    target,
  );
  return record;
}