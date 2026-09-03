import { NextResponse } from "next/server";
import { findUserByEmail, createSession, toPublic, purgeExpiredSessions } from "@/lib/accounts";
import { verifyPassword } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { roleFor } from "@/lib/marketing/roles";
import { resolveAppRole, dashboardPathFor } from "@/lib/rbac";
import { rateLimit } from "@/lib/marketing/guard";
import { writeSaasAudit } from "@/lib/saas/audit";
import { peekClaimRequest, redeemClaimRequest } from "@/lib/saas/propertyClaims";
import { pushNotification } from "@/lib/saas/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Client IP (XFF-aware) — mirrors guard.clientIp for plain Request handlers. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/auth/login { email, password }
 * Sets an httpOnly session cookie on success.
 * Brute-force blunting: sliding-window limits per IP and per account.
 */
export async function POST(request: Request) {
  if (!rateLimit(`login:ip:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many attempts, slow down" }, { status: 429 });
  }
  let body: { email?: string; password?: string; claimToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").toString().trim().toLowerCase();
  const password = (body.password ?? "").toString();

  if (email && !rateLimit(`login:acct:${email}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts for this account, try again later" }, { status: 429 });
  }

  const user = await findUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await purgeExpiredSessions();
  const token = await createSession(user.id);

  // Redeem a self-service property-claim token (?claim=…) if present, so an
  // existing user who starts a claim and then signs in gets the claim created
  // against their (explicit or newly-created) organization.
  const claimToken = typeof body.claimToken === "string" ? body.claimToken.trim() : "";
  if (claimToken && (await peekClaimRequest(claimToken).catch(() => null))) {
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
      // Best-effort at login; user can start again from the property page.
    }
  }

  const role = roleFor(user);
  const access = role !== null;
  const appDashboard = dashboardPathFor(await resolveAppRole(user));
  const res = NextResponse.json({
    user: { ...toPublic(user), isAdmin: access, marketingRole: role, appDashboard },
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