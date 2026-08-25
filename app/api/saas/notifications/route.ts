import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saas/notifications — current user's notifications (newest first, max 50).
 * PATCH /api/saas/notifications — mark one or all as read.
 */
export async function GET() {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const notifications = await prisma.notification.findMany({
    where: { userId: guard.user.email },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.markAllRead === true) {
    await prisma.notification.updateMany({
      where: { userId: guard.user.email, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Notification id required" }, { status: 400 });
  await prisma.notification.updateMany({
    where: { id, userId: guard.user.email },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
