import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — public liveness/readiness probe for deployment monitoring
 * and load-balancer health checks. Reports app liveness plus a lightweight
 * database reachability check. Never returns secrets or connection details.
 *
 * 200 { ok: true, app: "ok", db: "up" }
 * 503 { ok: false, app: "ok", db: "down" }
 */
export async function GET() {
  let db = "up";
  try {
    const { default: prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }
  const ok = db === "up";
  return NextResponse.json(
    { ok, app: "ok", db, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
