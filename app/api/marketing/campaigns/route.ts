import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { createCampaign, campaignStats } from "@/lib/marketing/campaigns";
import { writeAudit } from "@/lib/marketing/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marketing/campaigns — campaigns + real attribution stats. */
export async function GET() {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) return guard.response;
  const stats = await campaignStats();
  return NextResponse.json({ campaigns: stats });
}

async function auth(req: NextRequest) {
  const guard = await requireCapability("campaigns.manage");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }
  return { user: guard.user };
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if (!("user" in a)) return a;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  const campaign = await createCampaign({
    name,
    channel: s(body.channel) ?? "other",
    audience: s(body.audience),
    country: s(body.country),
    landingPage: s(body.landingPage),
    utmCampaign: s(body.utmCampaign),
    startAt: s(body.startAt),
    endAt: s(body.endAt),
    budget: num(body.budget),
    status: (s(body.status) as never) ?? "draft",
  });
  await writeAudit({ byEmail: a.user.email, action: "campaign.created", entity: "campaign", entityId: campaign.id, detail: campaign.name, ip: clientIp(req) });
  return NextResponse.json({ campaign }, { status: 201 });
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