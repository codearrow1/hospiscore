import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
} from "@/lib/marketing/guard";
import { getLead, moveStage } from "@/lib/marketing/leads";
import { writeAudit } from "@/lib/marketing/audit";
import { isLeadStage, isLostReason } from "@/lib/marketing/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/marketing/leads/[id]/stage — move a lead along the pipeline. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("leads.write");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const stage = body.stage;
  if (!isLeadStage(stage)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (stage === lead.stage) return NextResponse.json({ lead });

  const lostReason = stage === "lost" && isLostReason(body.lostReason) ? body.lostReason : undefined;
  if (stage === "lost" && !lostReason && body.lostReason) {
    return NextResponse.json({ error: "Choose a lost reason" }, { status: 400 });
  }

  const updated = await moveStage(id, stage as never, {
    byEmail: guard.user.email,
    lostReason,
    detail: typeof body.detail === "string" ? body.detail.slice(0, 400) : undefined,
  });
  if (!updated) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await writeAudit({
    byEmail: guard.user.email,
    action: "lead.stage",
    entity: "lead",
    entityId: id,
    detail: `${lead.stage} → ${stage}`,
    ip: clientIp(req),
  });
  return NextResponse.json({ lead: updated });
}