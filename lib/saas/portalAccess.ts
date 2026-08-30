/**
 * Portal access resolution for customer-side APIs (Phase 7).
 * Order: explicit KV binding (portal_links) → primary org contact by email.
 * Returns null when the user has no customer identity.
 */
import { getCurrentUser } from "@/lib/sessionCookie";
import { findOrgContactForUser } from "@/lib/saas/portalLinks";

export interface ResolvedOrg {
  organizationId: string;
  contactId: string;
  isPrimary: boolean;
}

/**
 * Resolve the org a signed-in user may operate in.
 *
 * Identity binding is explicit (S-01): a user is a customer only when they are
 * bound to an OrgContact through a portal-link KV record (minted via a one-time
 * admin claim token). We intentionally never fall back to a raw email match —
 * an attacker registering an unverified email that equals a public OrgContact
 * email must NOT inherit that customer's data / org scope.
 */
export async function resolveOrgForUser(user: { id: string; email: string }): Promise<ResolvedOrg | null> {
  const contact = await findOrgContactForUser(user.id).catch(() => null);
  if (!contact) return null;
  return { organizationId: contact.organizationId, contactId: contact.id, isPrimary: contact.isPrimary };
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
