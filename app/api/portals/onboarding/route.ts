import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { findAffiliateForUser, findOrgContactForUser, findPartnerForUser } from "@/lib/saas/portalLinks";
import { getChecklist, completeStep, isOnboardingKind } from "@/lib/saas/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve the caller's onboarding subject from their portal identity.
 *
 * Identity binding is explicit (S-01): we resolve via portal-link KV bindings /
 * the relational userId column only, never a raw email match. An attacker
 * registering an unverified email equal to a public OrgContact / Affiliate /
 * Partner email must NOT inherit that identity's portal data.
 */
async function resolveSubject(user: { id: string }): Promise<{ kind: "customer" | "affiliate" | "partner"; subjectId: string } | null> {
  const contact = await findOrgContactForUser(user.id).catch(() => null);
  if (contact) return { kind: "customer", subjectId: contact.organizationId };
  const aff = await findAffiliateForUser(user.id).catch(() => null);
  if (aff) return { kind: "affiliate", subjectId: aff.id };
  const partner = await findPartnerForUser(user.id).catch(() => null);
  if (partner) return { kind: "partner", subjectId: partner.id };
  return null;
}

/** GET /api/portals/onboarding — resolved checklist for the signed-in user. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const subject = await resolveSubject(user);
  if (!subject) return NextResponse.json({ error: "No portal identity found" }, { status: 404 });
  const steps = await getChecklist(subject.kind, subject.subjectId);
  return NextResponse.json({ kind: subject.kind, steps });
}

/** POST /api/portals/onboarding { stepKey } — persist a manual completion mark. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`onboarding:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const stepKey = typeof body.stepKey === "string" ? body.stepKey.trim() : "";
  if (!stepKey) return NextResponse.json({ error: "stepKey required" }, { status: 400 });
  const subject = await resolveSubject(user);
  if (!subject) return NextResponse.json({ error: "No portal identity found" }, { status: 404 });
  const result = await completeStep({
    kind: isOnboardingKind(subject.kind) ? subject.kind : "customer",
    subjectId: subject.subjectId,
    stepKey,
    byEmail: user.email,
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Persist failed" }));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const steps = await getChecklist(subject.kind, subject.subjectId);
  void clientIp(req);
  return NextResponse.json({ kind: subject.kind, steps }, { status: 201 });
}
