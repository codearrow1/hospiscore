import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";
import { initSaasDb } from "@/lib/saas/init";
import { recruitAffiliate } from "@/lib/saas/multiTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const childAffiliateId = String(body.childAffiliateId ?? "");
  if (!childAffiliateId) return NextResponse.json({ error: "childAffiliateId required" }, { status: 400 });

  try {
    const result = await recruitAffiliate({ parentAffiliateId: id, childAffiliateId });
    await writeSaasAudit({ byEmail: user.email, action: "affiliate.recruited", entity: "affiliate", entityId: id, detail: childAffiliateId, ip: clientIp(req) });
    return NextResponse.json({ recruitment: result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Recruit failed" }, { status: 400 });
  }
}
