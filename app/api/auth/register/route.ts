import { NextResponse } from "next/server";
import { createUser, createSession, toPublic, purgeExpiredSessions } from "@/lib/accounts";
import { hashPassword } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { roleFor } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register { name, email, password }
 * Creates an account and sets an httpOnly session cookie.
 */
export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string };
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