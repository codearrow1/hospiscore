import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { hasSaasPerm, isSaasRole, saasRoleFor, SAAS_ROLES } from "@/lib/saas/roles";
import { listUsers, setUserRole } from "@/lib/marketing/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listUsers();
  return NextResponse.json({ users, roles: SAAS_ROLES });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; role?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Validate role: must be a known SaaS role or null (to clear)
  if (body.role !== null && body.role !== undefined && !isSaasRole(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${SAAS_ROLES.join(", ")}` }, { status: 400 });
  }

  // Privilege-escalation guard. `SYSTEM_SETTINGS_MANAGE` is granted to both
  // super_admin and platform_admin (identical permission sets), so capability
  // alone is NOT enough to prove super-admin authority. Mirror the guard on
  // /api/marketing/users/[id]:
  //   - Only an existing super_admin may assign (or keep) the super_admin role.
  //   - No non-super-admin may alter their OWN role.
  //   - No non-super-admin may demote an existing super_admin.
  // Without this, a platform_admin could promote themselves (or anyone) to
  // super_admin and thereby take full SaaS control.
  const actorIsSuperAdmin = saasRoleFor(user) === "super_admin";
  const targetRole = body.role ?? null;

  if (targetRole === "super_admin" && !actorIsSuperAdmin) {
    return NextResponse.json(
      { error: "Only a Super Admin may assign the Super Admin role" },
      { status: 403 },
    );
  }
  if (body.userId === user.id && !actorIsSuperAdmin && targetRole !== user.role) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 403 });
  }
  if (!actorIsSuperAdmin) {
    const target = (await listUsers()).find((u) => u.id === body.userId);
    if (target?.role?.toLowerCase() === "super_admin") {
      return NextResponse.json(
        { error: "Only a Super Admin may change a Super Admin" },
        { status: 403 },
      );
    }
  }

  try {
    const updated = await setUserRole(body.userId, body.role ?? null);
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
