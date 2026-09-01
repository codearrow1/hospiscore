import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { listDemos, createDemo, type DemoBooking } from "@/lib/marketing/demos";
import { getLead } from "@/lib/marketing/leads";
import { writeAudit } from "@/lib/marketing/audit";
import { canAccessLead, hasCapability } from "@/lib/marketing/roles";
import type { AuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reps see/manage only demos tied to their own leads or assigned to them. */
async function canAccessDemo(user: AuthUser, demo: DemoBooking): Promise<boolean> {
  if (hasCapability(user, "leads.manage")) return true;
  if (demo.assignedTo?.toLowerCase() === user.email.toLowerCase()) return true;
  const lead = await getLead(demo.leadId);
  return !!lead && canAccessLead(user, lead);
}

/** GET /api/marketing/demos — all demo bookings (calendar/list). */
export async function GET() {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) return guard.response;
  const demos = await listDemos();
  if (hasCapability(guard.user, "leads.manage")) {
    return NextResponse.json({ demos });
  }
  const scoped = [];
  for (const d of demos) {
    if (await canAccessDemo(guard.user, d)) scoped.push(d);
  }
  return NextResponse.json({ demos: scoped });
}

async function auth(req: NextRequest) {
  const guard = await requireCapability("demos.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  return { user: guard.user };
}

/** POST /api/marketing/demos — book a demo for a lead. */
export async function POST(req: NextRequest) {
  const a = await auth(req);
  if (!("user" in a)) return a;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  if (!startAt || Number.isNaN(Date.parse(startAt))) {
    return NextResponse.json({ error: "A valid start time is required" }, { status: 400 });
  }
  const leadId = String(body.leadId ?? "");
  const targetLead = await getLead(leadId);
  // Reps can only book demos on leads they own (404: no existence probe).
  if (!targetLead || !canAccessLead(a.user, targetLead)) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const demo = await createDemo(
    {
      leadId,
      startAt: new Date(startAt).toISOString(),
      durationMin: num(body.durationMin) ?? 45,
      status: s(body.status) as never,
      demoType: s(body.demoType),
      assignedTo: s(body.assignedTo),
      meetingUrl: s(body.meetingUrl),
      notes: s(body.notes),
      city: s(body.city),
      country: s(body.country),
    },
    a.user.email,
  );
  if (!demo) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({ byEmail: a.user.email, action: "demo.created", entity: "demo", entityId: demo.id, detail: demo.leadId, ip: clientIp(req) });
  return NextResponse.json({ demo }, { status: 201 });
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