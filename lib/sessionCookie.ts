import { cookies } from "next/headers";
import { COOKIE_NAME, type AuthUser } from "@/lib/auth";
import { sessionUser, toPublic, type PublicUser } from "@/lib/accounts";

/**
 * Request-scoped session helpers for route handlers / server components.
 */

/** Read the raw session token from the httpOnly cookie. */
export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value;
}

/** Resolve the current authenticated user (or null). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return sessionUser(await getSessionToken());
}

export { toPublic, type PublicUser };