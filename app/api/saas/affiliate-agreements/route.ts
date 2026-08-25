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
  const affiliateId = searchParams.get("affiliateId");

  const where = affiliateId ? { affiliateId } : {};

  const [agreements, total] = await Promise.all([
    prisma.affiliateAgreement.findMany({
      where,
      include: { affiliate: { select: { name: true, email: true } } },
      orderBy: { acceptedAt: "desc" },
    }),
    prisma.affiliateAgreement.count({ where }),
  ]);

  return NextResponse.json({ agreements, total });
}

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { affiliateId, campaignId, version, title, content } = await req.json();

  const agreement = await prisma.affiliateAgreement.create({
    data: { affiliateId, campaignId, version, title, content },
  });

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_agreement.created", entity: "affiliateAgreement", entityId: agreement.id, ip: clientIp(req) });

  return NextResponse.json({ agreement });
}
