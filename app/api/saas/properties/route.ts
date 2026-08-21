import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listPropertiesByOrg, createProperty } from "@/lib/saas/properties";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PROPERTY_VIEW")) return NextResponse.json({ error: "PROPERTY_VIEW required" }, { status: 403 });
  const orgId = req.nextUrl.searchParams.get("organizationId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const items = await listPropertiesByOrg(orgId);
  return NextResponse.json({ properties: items });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "PROPERTY_MANAGE")) return NextResponse.json({ error: "PROPERTY_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const name = typeof body.name === "string" ? body.name : "";
  if (!organizationId || !name) return NextResponse.json({ error: "organizationId and name required" }, { status: 400 });
  try {
    // server-side limit enforcement — centralizes getPlanLimit/hasEntitlement
    const { enforceLimit } = await import("@/lib/saas/usage");
    try {
      await enforceLimit(organizationId, "properties", 1);
    } catch (limitErr) {
      return NextResponse.json({ error: limitErr instanceof Error ? limitErr.message : "Quota exceeded" }, { status: 429 });
    }
    const prop = await createProperty({
      organizationId,
      name,
      city: typeof body.city === "string" ? body.city : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      rooms: typeof body.rooms === "number" ? body.rooms : body.rooms ? Number(body.rooms) : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "property.created", entity: "property", entityId: prop.id, detail: name, ip: clientIp(req) });
    return NextResponse.json({ property: prop }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
