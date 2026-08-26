import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { hasSaasPerm, isSaasRole, SAAS_ROLES } from "@/lib/saas/roles";
import { listUsers, setUserRole } from "@/lib/marketing/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const users = await listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ user: target, roles: SAAS_ROLES });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSaasPerm(user, "SYSTEM_SETTINGS_MANAGE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: { role?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.role !== null && body.role !== undefined && !isSaasRole(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${SAAS_ROLES.join(", ")}` }, { status: 400 });
  }

  // Prevent self-demotion
  if (id === user.id && body.role !== null && body.role !== undefined) {
    const targetRole = body.role as string;
    if (targetRole !== "super_admin" && targetRole !== user.role) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }
  }

  try {
    const updated = await setUserRole(id, body.role ?? null);
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
