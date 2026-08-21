import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPartners, createPartner } from "@/lib/saas/partners";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_VIEW")) return NextResponse.json({ error: "PARTNER_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listPartners({ status });
  return NextResponse.json({ partners: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PARTNER_MANAGE")) return NextResponse.json({ error: "PARTNER_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const partner = await createPartner({
      name: String(body.name ?? ""),
      company: typeof body.company === "string" ? body.company : undefined,
      email: String(body.email ?? ""),
      phone: typeof body.phone === "string" ? body.phone : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      tier: typeof body.tier === "string" ? body.tier : undefined,
      commissionModel: typeof body.commissionModel === "string" ? body.commissionModel : undefined,
      commissionValue: body.commissionValue != null ? Number(body.commissionValue) : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "partner.created", entity: "partner", entityId: partner.id, detail: `${partner.name} (${partner.type})`, ip: clientIp(req) });
    return NextResponse.json({ partner }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
