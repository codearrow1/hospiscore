import { NextResponse } from "next/server";
import { requireSaasAccess } from "@/lib/marketing/guard";
import { resolveAppRole } from "@/lib/rbac";
import { seedDemoMonth } from "@/lib/saas/demoMonth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/saas/admin/seed-demo — populate a fresh environment with the
 * one-month demo dataset. Double-gated: super-admin session AND the
 * ALLOW_DEMO_SEED=1 env flag must both be present.
 */
export async function POST() {
  if (process.env.ALLOW_DEMO_SEED !== "1") {
    return NextResponse.json({ error: "Demo seeding is disabled on this server" }, { status: 403 });
  }
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  const role = await resolveAppRole(guard.user);
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }
  const summary = await seedDemoMonth(false);
  return NextResponse.json({ ok: true, ...summary });
}
