import { NextResponse } from "next/server";
import { findUserByEmail, createSession, toPublic, purgeExpiredSessions } from "@/lib/accounts";
import { verifyPassword } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { roleFor } from "@/lib/marketing/roles";
import { resolveAppRole, dashboardPathFor } from "@/lib/rbac";
import { rateLimit } from "@/lib/marketing/guard";

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
  let body: { email?: string; password?: string };
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