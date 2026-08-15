import { randomUUID } from "node:crypto";
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

export { COOKIE_NAME };
export type { AuthSession };