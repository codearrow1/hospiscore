import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { updateFranchiseeStatus, franchiseePerformance } from "@/lib/saas/franchise";
import type { FranchiseeStatus } from "@/lib/saas/franchise";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_VIEW")) return NextResponse.json({ error: "FRANCHISE_VIEW required" }, { status: 403 });
  const { id } = await params;
  try {
    const perf = await franchiseePerformance(id);
    return NextResponse.json({ performance: perf });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_MANAGE")) return NextResponse.json({ error: "FRANCHISE_MANAGE required" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const f = await updateFranchiseeStatus(id, String(body.status ?? "") as FranchiseeStatus);
    await writeSaasAudit({ byEmail: guard.user.email, action: `franchisee.${body.status}`, entity: "franchisee", entityId: id, ip: clientIp(req) });
    return NextResponse.json({ franchisee: f });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}
