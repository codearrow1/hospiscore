import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { getDemo, updateDemo, deleteDemo } from "@/lib/marketing/demos";
import { writeAudit } from "@/lib/marketing/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth(req: NextRequest) {
  const guard = await requireCapability("demos.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  return { user: guard.user };
}

/** PATCH /api/marketing/demos/[id] — reschedule / status / assignment. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await auth(req);
  if (!("user" in a)) return a;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const current = await getDemo(id);
  if (!current) return NextResponse.json({ error: "Demo not found" }, { status: 404 });
  const demo = await updateDemo(
    id,
    {
      startAt:
        typeof body.startAt === "string" && !Number.isNaN(Date.parse(body.startAt))
          ? new Date(body.startAt as string).toISOString()
          : undefined,
      durationMin: num(body.durationMin),
      status: (typeof body.status === "string" ? body.status : undefined) as never,
      assignedTo: s(body.assignedTo),
      meetingUrl: s(body.meetingUrl),
      notes: s(body.notes),
      phone: s(body.phone),
    },
    a.user.email,
  );
  await writeAudit({
    byEmail: a.user.email,
    action: "demo.updated",
    entity: "demo",
    entityId: id,
    detail: `${current.status} → ${demo?.status}`,
    ip: clientIp(req),
  });
  return NextResponse.json({ demo });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await auth(req);
  if (!("user" in a)) return a;
  const { id } = await params;
  const removed = await deleteDemo(id);
  if (!removed) return NextResponse.json({ error: "Demo not found" }, { status: 404 });
  await writeAudit({ byEmail: a.user.email, action: "demo.deleted", entity: "demo", entityId: id, ip: clientIp(req) });
  return NextResponse.json({ ok: true });
}

function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}