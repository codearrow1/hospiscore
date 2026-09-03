/**
 * Property claim verification (Phase D).
 *
 * Ownership proof ladder: a customer verifies a pending claim by proving
 * control of the phone/email on record with the Google listing.
 *
 * Flow:
 *  1. requestCode → generate a 6-digit OTP, store its SHA-256 hash + expiry keyed
 *     by (claimId, method) in the SystemSetting KV map. The plaintext is delivered
 *     out-of-band (SMS/email). In development (no provider wired) it is returned as
 *     debugCode so the flow is testable end-to-end.
 *  2. verifyCode → check the submitted code against the stored hash, burn it, and for
 *     phone_otp cross-check that the supplied phone matches the Google on-file phone
 *     recorded on the claim. On success the claim is marked verified.
 *
 * The SystemSetting KV store is injectable (like portalLinks) so the pure logic is
 * unit-testable without a database.
 */
import { createHash, randomInt } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type VerifyMethod = "phone_otp" | "email";
export const VERIFY_METHODS: readonly VerifyMethod[] = ["phone_otp", "email"];

export function isVerifyMethod(v: unknown): v is VerifyMethod {
  return typeof v === "string" && (VERIFY_METHODS as readonly string[]).includes(v);
}

export interface VerifyCodeRecord {
  method: VerifyMethod;
  target: string;
  hash: string;
  expiresAt: string;
}

const CODES_KEY = "property_verify_codes";
const CODE_TTL_MS = 5 * 60_000;

export interface VerificationStore {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

let storeOverride: VerificationStore | null = null;

/** Test seam: pass a fake store (its readCode/writeCode surface) or null to restore. */
export function __setVerificationStore(s: VerificationStore | null): void {
  storeOverride = s;
}

/** Development-only: return the plaintext OTP so flows work without SMS/email. */
function devDebugCode(): boolean {
  return process.env.NODE_ENV !== "production";
}

async function readMap(): Promise<Record<string, VerifyCodeRecord>> {
  let raw: unknown;
  if (storeOverride) {
    raw = await storeOverride.read(CODES_KEY);
  } else {
    try {
      const row = await prisma.systemSetting.findUnique({ where: { key: CODES_KEY } });
      raw = row?.value ?? {};
    } catch {
      raw = {};
    }
  }
  return (raw ?? {}) as Record<string, VerifyCodeRecord>;
}

async function writeMap(map: Record<string, VerifyCodeRecord>): Promise<void> {
  if (storeOverride) {
    await storeOverride.write(CODES_KEY, map);
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key: CODES_KEY },
    update: { value: map as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    create: { key: CODES_KEY, value: map as unknown as Prisma.InputJsonValue, updatedByEmail: "system" },
  });
}

function keyFor(claimId: string, method: VerifyMethod): string {
  return `${claimId}:${method}`;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function codeExpired(rec: Pick<VerifyCodeRecord, "expiresAt">, now = Date.now()): boolean {
  const t = Date.parse(rec.expiresAt);
  return !Number.isFinite(t) || t <= now;
}

/** Normalize a phone to digits for cross-channel comparison. */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/[^0-9]/g, "").replace(/^00/, "");
}

function maskTarget(method: VerifyMethod, target: string): string {
  if (method === "phone_otp") {
    const digits = normalizePhone(target);
    if (digits.length >= 4) return `••••${digits.slice(-4)}`;
    return target;
  }
  const at = target.indexOf("@");
  if (at > 0) return `${target[0]}***${target.slice(at)}`;
  return target;
}

export interface RequestCodeResult {
  ok: boolean;
  error?: string;
  maskedTarget?: string;
  expiresInSec?: number;
  /** Development-only; undefined in production (delivered via SMS/email instead). */
  debugCode?: string;
}

/**
 * Generate and store an OTP for a pending claim. `target` is the phone/email the
 * OTP is delivered to (the requester's). Requires claimId to reference a pending claim.
 */
export async function requestCode(params: {
  claimId: string;
  method: VerifyMethod;
  target: string;
}): Promise<RequestCodeResult> {
  const claim = await prisma.propertyClaim.findUnique({ where: { id: params.claimId }, select: { id: true, status: true } });
  if (!claim || claim.status !== "pending") {
    return { ok: false, error: "Claim not found or no longer pending" };
  }
  const target = params.target.trim();
  if (params.method === "phone_otp" && normalizePhone(target).length < 7) {
    return { ok: false, error: "A valid phone number is required" };
  }
  if (params.method === "email" && !/.+@.+\..+/.test(target)) {
    return { ok: false, error: "A valid email address is required" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const map = await readMap();
  const key = keyFor(params.claimId, params.method);
  map[key] = {
    method: params.method,
    target,
    hash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  };
  await writeMap(map);

  return {
    ok: true,
    maskedTarget: maskTarget(params.method, target),
    expiresInSec: Math.floor(CODE_TTL_MS / 1000),
    ...(devDebugCode() ? { debugCode: code } : {}),
  };
}

export interface VerifyCodeResult {
  ok: boolean;
  error?: string;
  verified?: boolean;
  verificationMethod?: VerifyMethod;
}

/**
 * Redeem an OTP to mark a claim verified. For phone_otp, `phone` must be supplied
 * and, when the Google on-file phone exists on the claim, must match it.
 */
export async function verifyCode(params: {
  claimId: string;
  method: VerifyMethod;
  code: string;
  phone?: string;
  byUser: string;
}): Promise<VerifyCodeResult> {
  const claim = await prisma.propertyClaim.findUnique({
    where: { id: params.claimId },
    select: { id: true, status: true, verified: true, googlePhone: true },
  });
  if (!claim || claim.status !== "pending") {
    return { ok: false, error: "Claim not found or no longer pending" };
  }
  if (claim.verified) return { ok: false, error: "Claim is already verified" };

  const map = await readMap();
  const key = keyFor(params.claimId, params.method);
  const rec = map[key];
  if (!rec || hashCode(params.code) !== rec.hash || codeExpired(rec)) {
    if (rec && codeExpired(rec)) {
      delete map[key];
      await writeMap(map);
    }
    return { ok: false, error: "Invalid or expired verification code" };
  }

  if (params.method === "phone_otp") {
    if (!params.phone || normalizePhone(params.phone).length < 7) {
      return { ok: false, error: "Phone is required to complete phone verification" };
    }
    if (claim.googlePhone && normalizePhone(claim.googlePhone) !== normalizePhone(params.phone)) {
      return { ok: false, error: "Phone does not match the Google on-file number for this listing" };
    }
  }

  delete map[key];
  await writeMap(map);

  const updated = await prisma.propertyClaim.update({
    where: { id: claim.id },
    data: {
      verified: true,
      verificationMethod: params.method,
      verifiedAt: new Date(),
      verifiedBy: params.byUser,
    },
    select: { id: true, verified: true, verificationMethod: true },
  });

  return {
    ok: true,
    verified: updated.verified,
    verificationMethod: updated.verificationMethod as VerifyMethod,
  };
}
