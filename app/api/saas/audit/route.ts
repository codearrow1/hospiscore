import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listAuditLogs } from "@/lib/saas/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "AUDIT_VIEW")) return NextResponse.json({ error: "AUDIT_VIEW required" }, { status: 403 });
  const actor = req.nextUrl.searchParams.get("actor") || undefined;
  const action = req.nextUrl.searchParams.get("action") || undefined;
  const targetType = req.nextUrl.searchParams.get("targetType") || undefined;
  const { items, total } = await listAuditLogs({ actorEmail: actor, action, targetType, take: 100 });
  return NextResponse.json({ logs: items, total });
}
