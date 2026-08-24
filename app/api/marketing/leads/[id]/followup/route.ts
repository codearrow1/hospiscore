import { NextRequest, NextResponse } from "next/server";
import { requireCapability, originAllowed, clientIp } from "@/lib/marketing/guard";
import { getLead, scheduleFollowUp } from "@/lib/marketing/leads";
import { writeAudit } from "@/lib/marketing/audit";
import { canAccessLead } from "@/lib/marketing/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/marketing/leads/[id]/followup — { at: ISO datetime } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("leads.write");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const { id } = await params;
  let body: { at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const at = typeof body.at === "string" ? body.at : "";
  if (!at || Number.isNaN(Date.parse(at))) {
    return NextResponse.json({ error: "A valid follow-up time is required" }, { status: 400 });
  }
  const existing = await getLead(id);
  if (!existing || !canAccessLead(guard.user, existing)) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const lead = await scheduleFollowUp(id, new Date(at).toISOString(), guard.user.email);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({ byEmail: guard.user.email, action: "lead.followup", entity: "lead", entityId: id, ip: clientIp(req) });
  return NextResponse.json({ lead });
}