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

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.key || typeof body.key !== "string" || !body.key.trim()) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { key, value } = body as { key: string; value: unknown };

  let setting;
  try {
    setting = await prisma.affiliateSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value), updatedByEmail: user.email },
      create: { key, value: JSON.stringify(value), updatedByEmail: user.email },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upsert failed" }, { status: 400 });
  }

  await writeSaasAudit({ byEmail: user.email, action: "affiliate_setting.updated", entity: "affiliateSetting", entityId: setting.key, ip: clientIp(req) });

  return NextResponse.json({ setting });
}
