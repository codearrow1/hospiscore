import { NextRequest, NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { listHealth, recomputeAllHealth } from "@/lib/saas/health";
import { writeSaasAudit } from "@/lib/saas/audit";
import { clientIp } from "@/lib/marketing/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_VIEW")) return NextResponse.json({ error: "CUSTOMER_VIEW required" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const { items, total } = await listHealth({ status });
  return NextResponse.json({ health: items, total });
}

export async function POST(req: NextRequest) {
  const guard = await requireMarketingUser();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "CUSTOMER_MANAGE")) return NextResponse.json({ error: "CUSTOMER_MANAGE required" }, { status: 403 });
  const result = await recomputeAllHealth();
  await writeSaasAudit({ byEmail: guard.user.email, action: "health.recomputed", entity: "organization", entityId: "*", detail: `${result.recomputed} orgs`, ip: clientIp(req) });
  return NextResponse.json({ ok: true, ...result });
}
