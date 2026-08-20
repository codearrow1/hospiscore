import { NextResponse } from "next/server";
import { toPublic } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin } from "@/lib/leads";
import { canAccess, roleFor } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — current user (or `{ user: null }` when signed out).
 * Admins (per `ADMIN_EMAILS` or a marketing role) get `isAdmin: true` and
 * `marketingRole` so the client can reveal internal entry points.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      ...toPublic(user),
      isAdmin: isAdmin(user),
      marketingRole: canAccess(user) ? roleFor(user) : null,
    },
  });
}