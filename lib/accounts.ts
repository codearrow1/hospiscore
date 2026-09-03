import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readData, writeData } from "@/lib/db";
import {
  COOKIE_NAME,
  cookieFromToken,
  createSessionRecord,
  isExpired,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth";

/**
 * Account (user + session) operations, stored in the shared account file.
 * Session tokens live in an httpOnly cookie; the token itself is the bearer.
 */

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export function toPublic(user: AuthUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export function findUserByEmail(email: string): Promise<AuthUser | undefined> {
  const norm = email.trim().toLowerCase();
  return readData().then((d) => d.users.find((u) => u.email.toLowerCase() === norm));
}

export function findUserById(id: string): Promise<AuthUser | undefined> {
  return readData().then((d) => d.users.find((u) => u.id === id));
}

/** Create a user. Throws when the email is already registered. */
export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  return writeData((data) => {
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error("EMAIL_TAKEN");
    }
    const user: AuthUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      createdAt: new Date().toISOString(),
      passwordHash: input.passwordHash,
    };
    return { ...data, users: [...data.users, user] };
  }).then((d) => d.users.find((u) => u.email === email)!);
}

/** Persist a fresh session for a user; returns the raw token to set as a cookie. */
export function createSession(userId: string): Promise<string> {
  const record = createSessionRecord(userId);
  const stored = { ...record, token: cookieFromToken(record.token) };
  return writeData((data) => ({
    ...data,
    sessions: [...data.sessions, stored],
  })).then(() => record.token);
}

/** Resolve a cookie token to its user (null when unknown/expired). */
export async function sessionUser(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const cookieValue = cookieFromToken(token);
  const data = await readData();
  const session = data.sessions.find((s) => s.token === cookieValue);
  if (!session || isExpired(session)) return null;
  const user = data.users.find((u) => u.id === session.userId);
  return user ?? null;
}

export function deleteSession(token: string): Promise<void> {
  const cookieValue = cookieFromToken(token);
  return writeData((data) => ({
    ...data,
    sessions: data.sessions.filter((s) => s.token !== cookieValue),
  })).then(() => undefined);
}

/** Clean up expired sessions. Runs opportunistically on login. */
export async function purgeExpiredSessions(): Promise<void> {
  await writeData((data) => ({
    ...data,
    sessions: data.sessions.filter((s) => !isExpired(s)),
  }));
}

// ---------------------------------------------------------------------------
// Password reset (Phase 7). Tokens are stored hashed — the raw token exists
// only in the reset link handed to the user, exactly like portal claims.
// ---------------------------------------------------------------------------

export const PASSWORD_RESET_TTL_MS = 30 * 60_000;

interface PasswordResetRecord {
  email: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Create a one-time reset token for an account. Returns null for unknown
 *  emails so callers can respond identically either way (no enumeration). */
export async function createPasswordReset(email: string): Promise<{ token: string; expiresAt: string } | null> {
  const norm = email.trim().toLowerCase();
  const user = await findUserByEmail(norm);
  if (!user) return null;
  const token = randomBytes(24).toString("base64url");
  const rec: PasswordResetRecord = {
    email: norm,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };
  await writeData((data) => ({
    ...data,
    // Opportunistic sweep of stale/used tokens.
    passwordResets: [
      ...(data.passwordResets ?? []).filter((r) => !r.usedAt && Date.parse(r.expiresAt) > Date.now()),
      rec,
    ],
  }));
  return { token, expiresAt: rec.expiresAt };
}

export async function peekPasswordReset(token: string): Promise<PasswordResetRecord | null> {
  const h = hashResetToken(token);
  const data = await readData();
  const rec = (data.passwordResets ?? []).find((r) => r.tokenHash === h);
  if (!rec || rec.usedAt || Date.parse(rec.expiresAt) <= Date.now()) return null;
  return rec;
}

/** Consume a reset token and set the new password hash. Throws on bad tokens. */
export async function consumePasswordReset(params: { token: string; passwordHash: string }): Promise<string> {
  const h = hashResetToken(params.token);
  const updated = await writeData((data) => {
    const rec = (data.passwordResets ?? []).find((r) => r.tokenHash === h);
    if (!rec || rec.usedAt || Date.parse(rec.expiresAt) <= Date.now()) {
      throw new Error("Invalid or expired reset token");
    }
    const users = data.users.map((u) =>
      u.email.toLowerCase() === rec.email ? { ...u, passwordHash: params.passwordHash } : u,
    );
    return {
      ...data,
      users,
      passwordResets: (data.passwordResets ?? []).map((r) =>
        r.tokenHash === h ? { ...r, usedAt: new Date().toISOString() } : r,
      ),
    };
  });
  const user = updated.users.find((u) => u.passwordHash === params.passwordHash && u.email.toLowerCase());
  return user?.email ?? "";
}

export { COOKIE_NAME };
export type { AuthSession };