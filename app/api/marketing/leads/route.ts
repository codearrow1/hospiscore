import { NextRequest, NextResponse } from "next/server";
import {
  requireCapability,
  originAllowed,
  clientIp,
  rateLimit,
} from "@/lib/marketing/guard";
import { ensureMarketingStore } from "@/lib/marketing/seed";
import { listLeads, filterLeads, upsertLead } from "@/lib/marketing/leads";
import { writeAudit } from "@/lib/marketing/audit";
import { isLeadStage } from "@/lib/marketing/stages";
import type { LeadSource } from "@/lib/marketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marketing/leads?q=&stage=&source=&country=&plan=&owner=&band= */
export async function GET(req: NextRequest) {
  const guard = await requireCapability("leads.read");
  if (!guard.ok) return guard.response;
  await ensureMarketingStore();

  const sp = req.nextUrl.searchParams;
  const leads = await listLeads();
  const filtered = filterLeads(leads, {
    q: sp.get("q") ?? undefined,
    stage: isLeadStage(sp.get("stage") ?? "") ? (sp.get("stage") as never) : "all",
    source: (sp.get("source") ?? "all") as never,
    country: sp.get("country") ?? undefined,
    plan: sp.get("plan") ?? undefined,
    owner: sp.get("owner") ?? undefined,
    band: ((sp.get("band") ?? "all") as never) || "all",
    minScore: sp.get("minScore") ? Number(sp.get("minScore")) : undefined,
  });
  return NextResponse.json({ leads: filtered, total: filtered.length });
}

/** POST /api/marketing/leads — manually create/upsert a lead. */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("leads.write");
  if (!guard.ok) return guard.response;
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  if (!rateLimit(`admin:${guard.user.email}`, 120, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await ensureMarketingStore();

  const source = (body.source as LeadSource) ?? "other";
  const lead = await upsertLead(
    {
      name: str(body.name) || "",
      email: str(body.email) || "",
      phone: str(body.phone),
      company: str(body.company),
      propertyName: str(body.propertyName),
      propertyType: str(body.propertyType),
      city: str(body.city),
      country: str(body.country),
      rooms: num(body.rooms),
      currentPms: str(body.currentPms),
      planInterest: str(body.planInterest),
      message: str(body.message),
      source,
      attribution: {
        source,
        pagePath: str(body.pagePath),
        campaign: str(body.campaign),
        medium: str(body.medium),
      },
      byEmail: guard.user.email,
    },
  );
  if (!lead) {
    return NextResponse.json({ error: "Name and email (or phone) are required" }, { status: 400 });
  }
  await writeAudit({
    byEmail: guard.user.email,
    action: "lead.created",
    entity: "lead",
    entityId: lead.id,
    detail: lead.email,
    ip: clientIp(req),
  });
  return NextResponse.json({ lead }, { status: 201 });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim().slice(0, 500) : undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}