import { NextResponse } from "next/server";
import { toPublic } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/sessionCookie";
import { isAdmin } from "@/lib/leads";
import { canAccess, roleFor } from "@/lib/marketing/roles";
import { resolveAppRole, dashboardPathFor } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — current user (or `{ user: null }` when signed out).
 * Admins (per `ADMIN_EMAILS` or a marketing role) get `isAdmin: true` and
 * `marketingRole` so the client can reveal internal entry points. Every role
 * with a canonical dashboard also gets `appDashboard` (role router path) so
 * the client can route sign-in to the right panel.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const appRole = await resolveAppRole(user);
  return NextResponse.json({
    user: {
      ...toPublic(user),
      isAdmin: isAdmin(user),
      marketingRole: canAccess(user) ? roleFor(user) : null,
      appDashboard: dashboardPathFor(appRole),
    },
  });
}
