import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { initSaasDb } from "@/lib/saas/init";
import { prisma } from "@/lib/prisma";
import { FRAUD_STATUSES, FRAUD_RESOLUTIONS } from "@/lib/saas/fraud";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const fraudCase = await prisma.affiliateFraudCase.findUnique({
    where: { id },
    include: { affiliate: { select: { name: true, email: true, referralCode: true } } },
  });

  if (!fraudCase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ fraudCase });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (body.status && !FRAUD_STATUSES.includes(body.status as never)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (body.resolution && !FRAUD_RESOLUTIONS.includes(body.resolution as never)) {
    return NextResponse.json({ error: "Invalid resolution" }, { status: 400 });
  }
  const { status, resolution, resolutionNote } = body as { status?: string; resolution?: string; resolutionNote?: string };

  let fraudCase;
  try {
    fraudCase = await prisma.affiliateFraudCase.update({
      where: { id },
      data: {
        status,
        resolution,
        resolutionNote,
        resolvedByEmail: user.email,
        resolvedAt: new Date(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_fraud.resolved", entity: "affiliateFraudCase", entityId: fraudCase.id, ip: clientIp(req) });

  return NextResponse.json({ fraudCase });
}
