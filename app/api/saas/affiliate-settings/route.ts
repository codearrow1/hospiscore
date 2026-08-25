import { NextResponse, NextRequest } from "next/server";
import { requireSaasAccess, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { writeSaasAudit } from "@/lib/saas/audit";
import { initSaasDb } from "@/lib/saas/init";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_VIEW")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await prisma.affiliateSetting.findMany();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const { user } = guard;
  if (!hasSaasPerm(user, "AFFILIATE_MANAGE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key, value } = await req.json();

  const setting = await prisma.affiliateSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(value), updatedByEmail: user.email },
    create: { key, value: JSON.stringify(value), updatedByEmail: user.email },
  });

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_setting.updated", entity: "affiliateSetting", entityId: setting.key, ip: clientIp(req) });

  return NextResponse.json({ setting });
}
