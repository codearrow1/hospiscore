import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { initSaasDb } from "@/lib/saas/init";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const application = await prisma.affiliateApplication.findUnique({
    where: { id },
    include: { affiliate: { select: { name: true, email: true, referralCode: true } } },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ application });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_APPROVE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (body.status && !["pending", "approved", "rejected"].includes(body.status as string)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const { status, reviewNote } = body as { status?: string; reviewNote?: string };

  const application = await prisma.affiliateApplication.update({
    where: { id },
    data: {
      status,
      reviewNote,
      reviewedByEmail: user.email,
      reviewedAt: new Date(),
    },
  });

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_application.reviewed", entity: "affiliateApplication", entityId: application.id, ip: clientIp(req) });

  return NextResponse.json({ application });
}
