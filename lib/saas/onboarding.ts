/**
 * Onboarding checklists (Phase 7) — role portals.
 *
 * Each checklist merges two sources:
 *  - auto steps: derived from real backend state (org exists, properties,
 *    invoices, clicks, commissions…) — never persisted, always recomputed;
 *  - manual marks: stored in the OnboardingProgress table via completeStep.
 *
 * The persisted table is the ONLY persistence; UI state is never trusted.
 */
import { prisma } from "@/lib/prisma";

export type OnboardingKind = "customer" | "affiliate" | "partner";
export const ONBOARDING_KINDS = ["customer", "affiliate", "partner"] as const;

export function isOnboardingKind(v: unknown): v is OnboardingKind {
  return typeof v === "string" && (ONBOARDING_KINDS as readonly string[]).includes(v);
}

export interface OnboardingStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  /** auto steps reflect live state; manual steps can be marked from the UI */
  source: "auto" | "manual";
}

/** Manual step keys allowed per kind — anything else is rejected. */
const MANUAL_STEPS: Record<OnboardingKind, Record<string, { label: string; hint: string }>> = {
  customer: {
    support_onboarded: {
      label: "Support & onboarding",
      hint: "Say hello — create your first ticket or mark your guided setup complete.",
    },
  },
  affiliate: {
    referral_link_ready: {
      label: "Referral link ready",
      hint: "Copy your link (or grab the QR) so you can start sharing.",
    },
  },
  partner: {
    referral_link_ready: {
      label: "Referral link ready",
      hint: "Copy your link so you can start referring organizations.",
    },
  },
};

async function completedMap(kind: OnboardingKind, subjectId: string): Promise<Set<string>> {
  const rows = await prisma.onboardingProgress.findMany({
    where: { subjectKind: kind, subjectId },
    select: { stepKey: true, completedAt: true },
  });
  return new Set(rows.map((r) => r.stepKey));
}

function merge(
  kind: OnboardingKind,
  done: Set<string>,
  autoResults: { key: string; label: string; hint: string; done: boolean }[],
): OnboardingStep[] {
  const autos = autoResults.map((s) => ({ ...s, source: "auto" as const }));
  const manualKeys = Object.keys(MANUAL_STEPS[kind]).filter((k) => !autos.some((a) => a.key === k));
  const manuals = manualKeys.map((key) => ({
    key,
    ...MANUAL_STEPS[kind][key],
    done: done.has(key),
    source: "manual" as const,
  }));
  return [...autos, ...manuals];
}

/** Customer: Organization → Property → Team → Invoice → Support/onboarding. */
export async function customerChecklist(organizationId: string): Promise<OnboardingStep[]> {
  const [org, propertyCount, contactCount, invoiceCount, done] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
    prisma.property.count({ where: { organizationId } }),
    prisma.orgContact.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId } }),
    completedMap("customer", organizationId),
  ]);
  return merge("customer", done, [
    { key: "organization", label: "Organization created", hint: "Your company record on HospiOS.", done: Boolean(org) },
    { key: "property", label: "First property added", hint: "Add the hotel/property you want to score.", done: propertyCount > 0 },
    { key: "team", label: "Team set up", hint: "Invite at least one colleague as an org contact.", done: contactCount > 1 },
    { key: "invoice", label: "Billing active", hint: "Your first invoice exists.", done: invoiceCount > 0 },
  ]);
}

/** Affiliate: Claim → Referral link → First click → First commission. */
export async function affiliateChecklist(affiliateId: string): Promise<OnboardingStep[]> {
  const [clickCount, commissionCount, done] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateCommission.count({ where: { affiliateId, status: { notIn: ["reversed", "rejected"] } } }),
    completedMap("affiliate", affiliateId),
  ]);
  return merge("affiliate", done, [
    { key: "claimed", label: "Account claimed", hint: "Portal identity bound to your login.", done: true },
    { key: "referral_link_shared", label: "First click", hint: "Someone visited through your link.", done: clickCount > 0 },
    { key: "first_commission", label: "First commission", hint: "A referral subscribed through your link.", done: commissionCount > 0 },
  ]);
}

/** Partner: Claim → Referral → Organization → Commission. */
export async function partnerChecklist(partnerId: string): Promise<OnboardingStep[]> {
  const [orgCount, commissionCount, done] = await Promise.all([
    prisma.organization.count({ where: { partnerId } }),
    prisma.affiliateCommission.count({ where: { partnerId, status: { notIn: ["reversed", "rejected"] } } }),
    completedMap("partner", partnerId),
  ]);
  return merge("partner", done, [
    { key: "claimed", label: "Account claimed", hint: "Portal identity bound to your login.", done: true },
    { key: "first_organization", label: "First referred organization", hint: "An organization signed up under your referral.", done: orgCount > 0 },
    { key: "first_commission", label: "First commission", hint: "A referred subscription activated.", done: commissionCount > 0 },
  ]);
}

export async function getChecklist(kind: OnboardingKind, subjectId: string): Promise<OnboardingStep[]> {
  switch (kind) {
    case "customer":
      return customerChecklist(subjectId);
    case "affiliate":
      return affiliateChecklist(subjectId);
    case "partner":
      return partnerChecklist(subjectId);
  }
}

/** Persist a manual completion mark. Auto keys are rejected with a clear error. */
export async function completeStep(params: { kind: OnboardingKind; subjectId: string; stepKey: string; byEmail: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { kind, subjectId, stepKey, byEmail } = params;
  if (!MANUAL_STEPS[kind][stepKey]) {
    return { ok: false, error: `Step "${stepKey}" is derived automatically and cannot be marked manually` };
  }
  await prisma.onboardingProgress.upsert({
    where: { subjectKind_subjectId_stepKey: { subjectKind: kind, subjectId, stepKey } },
    update: {},
    create: { subjectKind: kind, subjectId, stepKey, completedBy: byEmail },
  });
  return { ok: true };
}
