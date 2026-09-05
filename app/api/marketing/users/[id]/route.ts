import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { setUserRole } from "@/lib/marketing/users";
import { writeAudit } from "@/lib/marketing/audit";
import { isMarketingRole } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/marketing/users/[id] — { role: string|null } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("settings.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  const { id } = await params;
  let body: { role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const role = body.role === null || body.role === undefined ? null : String(body.role);
  if (role !== null && !isMarketingRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const updated = await setUserRole(id, role);
  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await writeAudit({
    byEmail: guard.user.email,
    action: "user.role",
    entity: "user",
    entityId: id,
    detail: `${updated.email} → ${role ?? "none"}`,
    ip: clientIp(req),
  });
  return NextResponse.json({ user: updated });
}