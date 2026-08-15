import { NextResponse } from "next/server";
import { toPublic } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — current user (or `{ user: null }` when signed out).
 * Admins (per `ADMIN_EMAILS`) get `isAdmin: true` so the client can reveal the
 * internal leads entry point.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { ...toPublic(user), isAdmin: isAdmin(user) } });
}