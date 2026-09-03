/**
 * Secret-at-rest encryption for the payment platform.
 *
 * Secrets (gateway API keys, webhook secrets, tokens) are NEVER stored in
 * plaintext and NEVER returned to the client after save. They are encrypted
 * with AES-256-GCM and keyed by:
 *   1. PAYMENT_ENC_KEY env (preferred — an opaque value, e.g. the output of
 *      `openssl rand -hex 64`), or
 *   2. a deterministic PBKDF2-derived key from the project's data-mirror path
 *      plus a build pepper, so a fresh self-hosted deploy works out of the
 *      box. Production SHOULD set PAYMENT_ENC_KEY.
 *
 * Cipher text format: `v1:<iv-hex>:<tag-hex>:<data-hex>`. Deterministic
 * derivation keeps tests hermetic. This is obfuscation-grade for demo/self-
 * hosted use; genuinely high-assurance deployments must set PAYMENT_ENC_KEY.
 */
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";

function envSecret(): string {
  return (process.env.PAYMENT_ENC_KEY ?? "").trim();
}

function deriveKey(): Buffer {
  const env = envSecret();
  if (env) {
    // Hash any length/key to a fixed 32-byte key.
    return createHash("sha256").update(`env:${env}`).digest();
  }
  const mirror = process.env.APP_DATA_MIRROR ?? path.join(process.cwd(), "var", "dummy");
  const pepper = "hospios::payments::v1";
  return pbkdf2Sync(`${mirror}::hpcore`, pepper, 100_000, 32, "sha256");
}

export function isPaymentEncKeyConfigured(): boolean {
  return envSecret().length > 0;
}

export function encryptSecret(plain: string): string {
  if (plain == null) return "";
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return "";
  const parts = String(stored).split(":");
  if (parts[0] !== "v1" || parts.length !== 4) return "";
  const key = deriveKey();
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const data = Buffer.from(parts[3], "hex");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key (rotated) or corrupted — callers must re-enter the secret.
    return "";
  }
}

/** Constant-time compare helper for webhook HMACs. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
