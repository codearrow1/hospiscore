import { NextResponse } from "next/server";
import { findUserByEmail, createSession, toPublic, purgeExpiredSessions } from "@/lib/accounts";
import { verifyPassword } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { roleFor } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login { email, password }
 * Sets an httpOnly session cookie on success.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").toString().trim();
  const password = (body.password ?? "").toString();

  const user = await findUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await purgeExpiredSessions();
  const token = await createSession(user.id);

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