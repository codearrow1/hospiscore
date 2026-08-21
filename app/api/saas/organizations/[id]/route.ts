import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getOrganization, updateOrganization, deleteOrganization } from "@/lib/saas/organizations";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_VIEW")) return NextResponse.json({ error: "CUSTOMER_VIEW required" }, { status: 403 });
  const { id } = await params;
  const org = await getOrganization(id);
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  return NextResponse.json({ organization: org });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_MANAGE")) return NextResponse.json({ error: "CUSTOMER_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.legalName === "string") patch.legalName = body.legalName;
  if (typeof body.businessName === "string") patch.businessName = body.businessName;
  if (typeof body.country === "string") patch.country = body.country;
  if (typeof body.industry === "string") patch.industry = body.industry;
  if (typeof body.website === "string") patch.website = body.website;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.healthScore === "number") patch.healthScore = body.healthScore;
  try {
    const before = await getOrganization(id);
    const org = await updateOrganization(id, patch as never);
    await writeSaasAudit({ byEmail: guard.user.email, action: "org.updated", entity: "organization", entityId: id, detail: Object.keys(patch).join(","), ip: clientIp(req), before: { legalName: before?.legalName }, after: { legalName: org.legalName } });
    return NextResponse.json({ organization: org });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_MANAGE")) return NextResponse.json({ error: "CUSTOMER_MANAGE required" }, { status: 403 });
  const { id } = await params;
  const org = await getOrganization(id);
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  await deleteOrganization(id);
  await writeSaasAudit({ byEmail: guard.user.email, action: "org.deleted", entity: "organization", entityId: id, detail: org.legalName, ip: clientIp(req) });
  return NextResponse.json({ ok: true });
}
