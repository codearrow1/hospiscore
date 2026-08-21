import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listOrganizations, createOrganization } from "@/lib/saas/organizations";
import { getAffiliateByCode } from "@/lib/saas/affiliates";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_VIEW")) return NextResponse.json({ error: "CUSTOMER_VIEW required" }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const { items, total } = await listOrganizations({ q });
  return NextResponse.json({ organizations: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_MANAGE")) return NextResponse.json({ error: "CUSTOMER_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const legalName = typeof body.legalName === "string" ? body.legalName.trim() : "";
  if (!legalName) return NextResponse.json({ error: "legalName is required" }, { status: 400 });
  let primaryContact: { name: string; email: string; phone?: string } | undefined;
  if (body.primaryContact && typeof body.primaryContact === "object") {
    const pc = body.primaryContact as Record<string, unknown>;
    const n = typeof pc.name === "string" ? pc.name.trim() : "";
    const e = typeof pc.email === "string" ? pc.email.trim() : "";
    if (n && e) primaryContact = { name: n, email: e, phone: typeof pc.phone === "string" ? pc.phone : undefined };
  }
  // affiliate attribution via explicit affiliateId / referralCode / aff_ref cookie
  let affiliateId: string | undefined;
  const rawCode = typeof body.affiliateCode === "string" ? body.affiliateCode : typeof body.ref === "string" ? body.ref : req.cookies.get("aff_ref")?.value;
  if (typeof body.affiliateId === "string" && body.affiliateId) affiliateId = body.affiliateId;
  else if (rawCode) {
    const aff = await getAffiliateByCode(String(rawCode));
    if (aff && (aff.status === "active" || aff.status === "approved")) affiliateId = aff.id;
  }
  let org;
  try {
    org = await createOrganization({
      legalName,
      businessName: typeof body.businessName === "string" ? body.businessName : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      acquisitionSource: typeof body.acquisitionSource === "string" ? body.acquisitionSource : undefined,
      acquisitionCampaign: typeof body.acquisitionCampaign === "string" ? body.acquisitionCampaign : undefined,
      affiliateId,
      primaryContact,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid input" }, { status: 400 });
  }
  await writeSaasAudit({ byEmail: guard.user.email, action: "org.created", entity: "organization", entityId: org.id, detail: legalName, ip: clientIp(req) });
  return NextResponse.json({ organization: org }, { status: 201 });
}
