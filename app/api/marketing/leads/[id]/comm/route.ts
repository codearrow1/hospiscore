import { NextRequest, NextResponse } from "next/server";
import { requireCapability, originAllowed, clientIp } from "@/lib/marketing/guard";
import { recordCommunication } from "@/lib/marketing/leads";
import { writeAudit } from "@/lib/marketing/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/marketing/leads/[id]/comm — { kind: email|whatsapp|call, detail } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("leads.write");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const { id } = await params;
  let body: { kind?: string; detail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const kind = body.kind;
  if (kind !== "email" && kind !== "whatsapp" && kind !== "call") {
    return NextResponse.json({ error: "kind must be email, whatsapp or call" }, { status: 400 });
  }
  const lead = await recordCommunication(
    id,
    kind,
    typeof body.detail === "string" ? body.detail.slice(0, 1000) : "",
    guard.user.email,
  );
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({ byEmail: guard.user.email, action: `lead.${kind}`, entity: "lead", entityId: id, ip: clientIp(req) });
  return NextResponse.json({ lead });
}