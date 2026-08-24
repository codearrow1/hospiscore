/**
 * Portal access resolution for customer-side APIs (Phase 7).
 * Order: explicit KV binding (portal_links) → primary org contact by email.
 * Returns null when the user has no customer identity.
 */
import { getCurrentUser } from "@/lib/sessionCookie";
import { prisma } from "@/lib/prisma";
import { getPortalBinding } from "@/lib/saas/portalLinks";

export interface ResolvedOrg {
  organizationId: string;
  contactId: string;
  isPrimary: boolean;
}

export async function resolveOrgForUser(user: { id: string; email: string }): Promise<ResolvedOrg | null> {
  const b = await getPortalBinding(user.id).catch(() => null);
  if (b?.kind === "org_contact") {
    const c = await prisma.orgContact.findFirst({
      where: { id: b.refId },
      select: { id: true, organizationId: true, isPrimary: true },
    });
    if (c) return { organizationId: c.organizationId, contactId: c.id, isPrimary: c.isPrimary };
  }
  const byEmail = await prisma.orgContact.findFirst({
    where: { email: user.email.toLowerCase(), organization: { status: { not: "cancelled" } } },
    orderBy: { isPrimary: "desc" },
    select: { id: true, organizationId: true, isPrimary: true },
  });
  return byEmail ? { organizationId: byEmail.organizationId, contactId: byEmail.id, isPrimary: byEmail.isPrimary } : null;
}

/** Session + org in one call for customer API routes. */
export async function requireCustomerOrg(): Promise<
  { ok: false; status: number; error: string } | { ok: true; user: { id: string; email: string }; org: ResolvedOrg }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const org = await resolveOrgForUser(user);
  if (!org) return { ok: false, status: 403, error: "No customer account found for this login" };
  return { ok: true, user: { id: user.id, email: user.email }, org };
}
