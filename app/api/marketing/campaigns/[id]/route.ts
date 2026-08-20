import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { updateCampaign, deleteCampaign } from "@/lib/marketing/campaigns";
import { writeAudit } from "@/lib/marketing/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth(req: NextRequest) {
  const guard = await requireCapability("campaigns.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  return { user: guard.user };
}

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
  const campaign = await updateCampaign(id, {
    name: s(body.name),
    channel: s(body.channel),
    audience: s(body.audience),
    country: s(body.country),
    landingPage: s(body.landingPage),
    utmCampaign: s(body.utmCampaign),
    startAt: s(body.startAt),
    endAt: s(body.endAt),
    budget: num(body.budget),
    status: s(body.status) as never,
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  await writeAudit({ byEmail: a.user.email, action: "campaign.updated", entity: "campaign", entityId: id, ip: clientIp(req) });
  return NextResponse.json({ campaign });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await auth(req);
  if (!("user" in a)) return a;
  const { id } = await params;
  const removed = await deleteCampaign(id);
  if (!removed) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  await writeAudit({ byEmail: a.user.email, action: "campaign.deleted", entity: "campaign", entityId: id, ip: clientIp(req) });
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