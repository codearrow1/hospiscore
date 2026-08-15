import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/accounts";
import { COOKIE_NAME } from "@/lib/auth";
import { getSessionToken } from "@/lib/sessionCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — clears the session cookie and server session.
 */
export async function POST() {
  const token = await getSessionToken();
  if (token) await deleteSession(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE_NAME, value: "", httpOnly: true, path: "/", maxAge: 0 });
  return res;
}