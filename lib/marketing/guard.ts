/**
 * Request guards for the marketing admin (server-only).
 *
 * Provides the shared auth + capability + CSRF + rate-limit plumbing used by
 * every /api/marketing/* route. API mutations reject invalid Origin headers to
 * block cross-site requests; public form endpoints get a light per-key rate
 * limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { CONFIG } from "@/lib/config";
import { SITE_URL } from "@/lib/site";
import type { AuthUser } from "@/lib/auth";
import { hasCapability, roleFor, type Capability, type MarketingRole } from "./roles";
import { isSaasRole } from "@/lib/saas/roles";

export interface MarketingUser {
  user: AuthUser;
  role: MarketingRole | null;
}

export type GuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

/** Authenticate + require the marketing admin at all. */
export async function requireMarketingUser(): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  if (!hasCapability(user, "access")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Marketing admin access required" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user };
}

/**
 * Authenticate + require SaaS-plane access: any marketing role OR any
 * SaaS-only role (support_admin, finance_admin, …). Permission checks stay
 * with hasSaasPerm at each route; this only replaces the old marketing-only
 * gate that locked SaaS-only roles out of APIs their permissions allow.
 */
export async function requireSaasAccess(): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  const marketing = roleFor(user);
  if (!marketing && !isSaasRole(user.role ?? "")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "SaaS access required" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user };
}

/** Authenticate + require a specific capability. */
export async function requireCapability(
  capability: Capability,
): Promise<GuardResult> {
  const base = await requireMarketingUser();
  if (!base.ok) return base;
  if (!hasCapability(base.user, capability)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `You need ${capability} permission` },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user: base.user };
}

/**
 * Reject state-changing requests whose Origin does not match the site.
 * Undefined Origin is allowed (same-origin fetch/non-browser clients).
 */
export function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const u = new URL(origin);
    const site = new URL(SITE_URL);
    return u.host === site.host;
  } catch {
    return false;
  }
}

/** Client IP for audit/rate limiting (X-Forwarded-For from proxies). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Lightweight in-memory sliding-window rate limiter. Not distributed; good
 * enough to blunt abuse of public POST endpoints in a single-node deploy.
 * Expired buckets are swept when the map grows, so unique-IP abuse cannot
 * leak memory indefinitely.
 */
const buckets = new Map<string, { at: number; count: number }>();
const BUCKET_SWEEP_THRESHOLD = 5_000;

export function rateLimit(
  key: string,
  max: number = CONFIG.publicRateMax,
  windowMs: number = CONFIG.publicRateWindowMs,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.at >= windowMs) {
    if (buckets.size >= BUCKET_SWEEP_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (now - b.at >= windowMs) buckets.delete(k);
      }
    }
    buckets.set(key, { at: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  if (bucket.count > max) return false;
  return true;
}

/** Reset the limiter (tests). */
export function __resetRateLimiter(): void {
  buckets.clear();
}