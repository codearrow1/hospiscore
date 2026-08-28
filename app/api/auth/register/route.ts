import { NextResponse } from "next/server";
import { createUser, createSession, toPublic, purgeExpiredSessions } from "@/lib/accounts";
import { hashPassword } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { roleFor } from "@/lib/marketing/roles";
import { rateLimit } from "@/lib/marketing/guard";
import { peekPortalClaimToken, consumePortalClaimToken } from "@/lib/saas/portalLinks";
import { peekClaimRequest, redeemClaimRequest } from "@/lib/saas/propertyClaims";
import { writeSaasAudit } from "@/lib/saas/audit";
import { pushNotification } from "@/lib/saas/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client IP (XFF-aware) — mirrors guard.clientIp for plain Request handlers. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/auth/register { name, email, password, claimToken? }
 * Creates an account and sets an httpOnly session cookie. Per-IP rate limited.
 */
export async function POST(request: Request) {
  if (!rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, slow down" }, { status: 429 });
  }
  let body: { name?: string; email?: string; password?: string; claimToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim();
  const email = (body.email ?? "").toString().trim();
  const password = (body.password ?? "").toString();

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  // Claim tokens are validated up-front so a bad token never creates an
  // account. Two kinds are accepted:
  //  - property_claim (self-service): a visitor with no account starts a claim,
  //    then registers with the token → server creates org + contact + claim.
  //  - portal (admin-minted): binds a fresh registration to an existing
  //    affiliate/partner/org-contact identity. Registration alone never grants
  //    portal identity (S-01) — binding happens only through this one-time token.
  const claimToken = typeof body.claimToken === "string" ? body.claimToken.trim() : "";
  let isPortalClaim = false;
  if (claimToken) {
    const propertyClaim = await peekClaimRequest(claimToken).catch(() => null);
    const portal = propertyClaim ? null : await peekPortalClaimToken(claimToken).catch(() => null);
    if (!propertyClaim && !portal) {
      return NextResponse.json({ error: "Invalid or expired claim token" }, { status: 400 });
    }
    isPortalClaim = Boolean(portal);
  }

  let user;
  try {
    user = await createUser({
      name,
      email,
      passwordHash: await hashPassword(password),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }
    throw err;
  }

  if (claimToken) {
    if (isPortalClaim) {
      try {
        await consumePortalClaimToken({ token: claimToken, userId: user.id, boundBy: user.email });
        await writeSaasAudit({ byEmail: user.email, action: "portal.identity_claimed", entity: "user", entityId: user.id });
      } catch {
        // Token raced to expiry between peek and consume — account exists but
        // stays unbound; the admin can mint a fresh token.
      }
    } else {
      // Self-service property claim: create org + contact + PropertyClaim.
      try {
        const redeemed = await redeemClaimRequest({ token: claimToken, userId: user.id, byEmail: user.email });
        await writeSaasAudit({
          byEmail: user.email,
          action: redeemed.ok ? "property_claim.self_claimed" : "property_claim.self_claim_failed",
          entity: "propertyClaim",
          entityId: redeemed.ok ? redeemed.claimId : undefined,
          detail: redeemed.ok ? undefined : redeemed.error,
          actorId: user.id,
        });
        if (redeemed.ok) {
          await pushNotification({
            userId: user.id,
            kind: "property_claim",
            title: "Claim submitted",
            body: "Your property claim is submitted and now awaits verification and admin review.",
            href: "/customer",
          });
        }
      } catch {
        // Claim creation is best-effort at registration; the user can start
        // again from the property page if the token raced to expiry.
      }
    }
  }

  const token = await createSession(user.id);
  await purgeExpiredSessions();

  const role = roleFor(user);
  const access = role !== null;
  const res = NextResponse.json({
    user: { ...toPublic(user), isAdmin: access, marketingRole: role },
    ok: true,
  });
  res.cookies.set({
    name: CONFIG.sessionCookie,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONFIG.sessionDays * 24 * 60 * 60,
  });
  return res;
}