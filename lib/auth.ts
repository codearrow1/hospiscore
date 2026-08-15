import { promisify } from "node:util";
import { scrypt as scryptCb, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { CONFIG } from "@/lib/config";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  passwordHash: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/** Hash a plaintext password into `scrypt:salt:hash` (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

/** Verify a plaintext password against an encoded hash. */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [scheme, saltB64, hashB64] = encoded.split(":");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Create a new random session token. */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Deterministic cookie value derived from a session token. */
export function cookieFromToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const COOKIE_NAME = CONFIG.sessionCookie;
const SESSION_TTL_MS = CONFIG.sessionDays * 24 * 60 * 60 * 1000;

/** Build a session record for a fresh login. */
export function createSessionRecord(userId: string): AuthSession {
  const now = Date.now();
  return {
    token: newSessionToken(),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
}

export function isExpired(session: Pick<AuthSession, "expiresAt">): boolean {
  return Date.parse(session.expiresAt) <= Date.now();
}