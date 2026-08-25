import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { initSaasDb } from "@/lib/saas/init";
import { prisma } from "@/lib/prisma";
import { InputJsonValue } from "@prisma/client/runtime/library";

export async function GET(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = status ? { status } : {};

  const [applications, total] = await Promise.all([
    prisma.affiliateApplication.findMany({
      where,
      include: { affiliate: { select: { name: true, email: true, referralCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.affiliateApplication.count({ where }),
  ]);

  return NextResponse.json({ applications, total });
}

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.affiliateId || typeof body.affiliateId !== "string" || !(body.affiliateId as string).trim()) {
    return NextResponse.json({ error: "affiliateId required" }, { status: 400 });
  }

  const { affiliateId, website, audience, socialProfiles, promotionMethod, geography, niche, expectedTraffic, planDescription } = body as { affiliateId: string; website?: string; audience?: string; socialProfiles?: Record<string, unknown>; promotionMethod?: string; geography?: string; niche?: string; expectedTraffic?: string; planDescription?: string };

  const application = await prisma.affiliateApplication.create({
    data: {
      affiliateId,
      website,
      audience,
      socialProfiles: socialProfiles as unknown as InputJsonValue,
      promotionMethod,
      geography,
      niche,
      expectedTraffic,
      planDescription,
      status: "pending",
    },
  });

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_application.submitted", entity: "affiliateApplication", entityId: application.id, ip: clientIp(req) });

  return NextResponse.json({ application });
}
