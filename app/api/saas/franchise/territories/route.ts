import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listTerritories, createTerritory } from "@/lib/saas/franchise";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_VIEW")) return NextResponse.json({ error: "FRANCHISE_VIEW required" }, { status: 403 });
  const country = req.nextUrl.searchParams.get("country") || undefined;
  const { items, total } = await listTerritories({ country });
  return NextResponse.json({ territories: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_MANAGE")) return NextResponse.json({ error: "FRANCHISE_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const t = await createTerritory({
      name: String(body.name ?? ""),
      country: String(body.country ?? ""),
      region: typeof body.region === "string" ? body.region : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      type: String(body.type ?? ""),
      exclusive: Boolean(body.exclusive),
      franchiseeId: typeof body.franchiseeId === "string" && body.franchiseeId ? body.franchiseeId : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "territory.created", entity: "territory", entityId: t.id, detail: `${t.name} (${t.type}, ${t.country})`, ip: clientIp(req) });
    return NextResponse.json({ territory: t }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
