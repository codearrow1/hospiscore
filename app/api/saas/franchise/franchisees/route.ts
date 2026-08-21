import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listFranchisees, createFranchisee } from "@/lib/saas/franchise";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_VIEW")) return NextResponse.json({ error: "FRANCHISE_VIEW required" }, { status: 403 });
  const { items, total } = await listFranchisees();
  return NextResponse.json({ franchisees: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "FRANCHISE_MANAGE")) return NextResponse.json({ error: "FRANCHISE_MANAGE required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const f = await createFranchisee({
      company: String(body.company ?? ""),
      contactName: String(body.contactName ?? ""),
      email: String(body.email ?? ""),
      phone: typeof body.phone === "string" ? body.phone : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      revenueShareBps: body.revenueShareBps != null ? Number(body.revenueShareBps) : undefined,
    });
    await writeSaasAudit({ byEmail: guard.user.email, action: "franchisee.created", entity: "franchisee", entityId: f.id, detail: f.company, ip: clientIp(req) });
    return NextResponse.json({ franchisee: f }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}




