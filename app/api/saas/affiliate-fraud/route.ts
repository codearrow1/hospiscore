import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { initSaasDb } from "@/lib/saas/init";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = status ? { status } : {};

  const [cases, total] = await Promise.all([
    prisma.affiliateFraudCase.findMany({
      where,
      include: { affiliate: { select: { name: true, email: true, referralCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.affiliateFraudCase.count({ where }),
  ]);

  return NextResponse.json({ cases, total });
}

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { affiliateId, riskScore, reasons } = await req.json();

  const fraudCase = await prisma.affiliateFraudCase.create({
    data: { affiliateId, riskScore, reasons },
  });

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_fraud.flagged", entity: "affiliateFraudCase", entityId: fraudCase.id, ip: clientIp(req) });

  return NextResponse.json({ fraudCase });
}
