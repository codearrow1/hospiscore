import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/marketing/guard";
import { listUsers } from "@/lib/marketing/users";
import { MARKETING_ROLES, ROLE_LABELS } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marketing/users — team directory + role matrix. */
export async function GET() {
  const guard = await requireCapability("settings.manage");
  if (!guard.ok) return guard.response;
  const users = await listUsers();
  return NextResponse.json({
    users,
    roles: MARKETING_ROLES.map((r) => ({ id: r, label: ROLE_LABELS[r] })),
  });
}