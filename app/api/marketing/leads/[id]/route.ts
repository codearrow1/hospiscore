import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { getLead, updateLead, deleteLead, convertLead } from "@/lib/marketing/leads";
import { eventsForLead } from "@/lib/marketing/events";
import { writeAudit } from "@/lib/marketing/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const [lead, events] = await Promise.all([getLead(id), eventsForLead(id)]);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead, events });
}

async function mutate(
  req: NextRequest,
  params: Promise<{ id: string }>,
  capability: "leads.write" | "leads.manage",
): Promise<{ ok: true; user: { email: string } } | { ok: false; response: NextResponse }> {
  const guard = await requireCapability(capability);
  if (!guard.ok) return { ok: false, response: guard.response };
  if (!originAllowed(req)) {
    return { ok: false, response: NextResponse.json({ error: "Rejected" }, { status: 403 }) };
  }
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return { ok: false, response: NextResponse.json({ error: "Slow down" }, { status: 429 }) };
  }
  return { ok: true, user: { email: guard.user.email } };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await mutate(req, params, "leads.write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = {
    name: s(body.name),
    email: s(body.email),
    phone: s(body.phone),
    company: s(body.company),
    propertyName: s(body.propertyName),
    propertyType: s(body.propertyType),
    city: s(body.city),
    country: s(body.country),
    rooms: n(body.rooms),
    currentPms: s(body.currentPms),
    planInterest: s(body.planInterest),
    billingCycle: (body.billingCycle === "yearly" || body.billingCycle === "monthly" ? body.billingCycle : undefined) as "yearly" | "monthly" | undefined,
    message: s(body.message),
    ownerEmail: s(body.ownerEmail),
    nextFollowUpAt: s(body.nextFollowUpAt),
    lostReason: s(body.lostReason),
    note: s(body.note),
  };
  const lead = await updateLead(id, patch, auth.user.email);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({
    byEmail: auth.user.email,
    action: "lead.updated",
    entity: "lead",
    entityId: id,
    detail: Object.keys(patch).filter((k) => k !== "note").join(","),
    ip: clientIp(req),
  });
  return NextResponse.json({ lead });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await mutate(req, params, "leads.manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const removed = await deleteLead(id);
  if (!removed) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({ byEmail: auth.user.email, action: "lead.deleted", entity: "lead", entityId: id, ip: clientIp(req) });
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await mutate(req, params, "leads.manage");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const lead = await convertLead(
    id,
    {
      plan: s(body.plan),
billingCycle: (body.billingCycle === "yearly" || body.billingCycle === "monthly" ? body.billingCycle : undefined) as "yearly" | "monthly" | undefined,
      organizationId: s(body.organizationId),
      adminUserId: s(body.adminUserId),
      notes: s(body.notes),
      byEmail: auth.user.email,
    },
  );
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({ byEmail: auth.user.email, action: "lead.converted", entity: "lead", entityId: id, ip: clientIp(req) });
  return NextResponse.json({ lead });
}

function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : undefined;
}
function n(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  }
  return undefined;
}