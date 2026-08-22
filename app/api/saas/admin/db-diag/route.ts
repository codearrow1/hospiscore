import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/sessionCookie";
import { appRoleFromStoredRole } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Step = { step: string; ok: boolean; detail?: string };

function errText(e: unknown): string {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return msg.slice(0, 400);
}

/**
 * GET /api/saas/admin/db-diag — super-admin-only, prisma-free module that
 * probes the SaaS database chain step by step with dynamic imports so it can
 * report exactly which stage fails on hosts where static imports crash.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (appRoleFromStoredRole(user) !== "super_admin") {
    return NextResponse.json({ error: "Super admin only" }, { status: 403 });
  }

  const steps: Step[] = [];
  const env = {
    node: process.version,
    platform: process.platform,
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
    allowDemoSeed: process.env.ALLOW_DEMO_SEED === "1",
  };

  try {
    const { readFile } = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const cwd = process.cwd();
    const classPath = pathMod.join(cwd, "lib/generated/prisma/internal/class.ts");
    let classSrc = "";
    try {
      classSrc = await readFile(classPath, "utf8");
    } catch (e) {
      steps.push({ step: "read generated class.ts", ok: false, detail: errText(e) });
    }
    if (classSrc) {
      const stale = classSrc.includes("library.mjs");
      steps.push({
        step: "generated client freshness",
        ok: true,
        detail: stale ? "STALE (explicit library.mjs import)" : "FRESH (extensionless/CJS import)",
      });
    }
    const rtDir = pathMod.join(cwd, "node_modules/@prisma/client/runtime");
    for (const f of ["library.js", "library.mjs"]) {
      try {
        await readFile(pathMod.join(rtDir, f));
        steps.push({ step: `runtime file exists: ${f}`, ok: true });
      } catch {
        steps.push({ step: `runtime file exists: ${f}`, ok: false });
      }
    }
  } catch (e) {
    steps.push({ step: "fs probes", ok: false, detail: errText(e) });
  }

  // Native runtime import that webpack cannot rewrite — probes the real
  // files in node_modules instead of bundled copies.
  const nativeImport = new Function("s", "return import(s)") as (s: string) => Promise<unknown>;

  try {
    const mod = await nativeImport("@prisma/client/runtime/library.js");
    steps.push({ step: "import runtime/library.js (CJS)", ok: true });
    void mod;
  } catch (e) {
    steps.push({ step: "import runtime/library.js (CJS)", ok: false, detail: errText(e) });
  }

  try {
    const mod = await nativeImport("@prisma/client/runtime/library.mjs");
    steps.push({ step: "import runtime/library.mjs (ESM)", ok: true });
    void mod;
  } catch (e) {
    steps.push({ step: "import runtime/library.mjs (ESM)", ok: false, detail: errText(e) });
  }

  let client: unknown = null;
  try {
    const mod = await import("@/lib/generated/prisma/client");
    client = mod.PrismaClient;
    steps.push({ step: "import generated client", ok: true });
  } catch (e) {
    steps.push({ step: "import generated client", ok: false, detail: errText(e) });
  }

  try {
    const { absoluteSqliteUrl } = await import("@/lib/saas/dbUrl");
    steps.push({ step: "resolve db url", ok: true, detail: absoluteSqliteUrl() });
  } catch (e) {
    steps.push({ step: "resolve db url", ok: false, detail: errText(e) });
  }

  try {
    const { initSaasDb } = await import("@/lib/saas/init");
    await initSaasDb();
    steps.push({ step: "initSaasDb (mkdir+migrations+plans)", ok: true });
  } catch (e) {
    steps.push({ step: "initSaasDb (mkdir+migrations+plans)", ok: false, detail: errText(e) });
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const migCount = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*) as n FROM "_prisma_migrations"`;
    steps.push({ step: "migrations applied", ok: true, detail: String(migCount[0]?.n) });
    const plans = await prisma.plan.count();
    steps.push({ step: "plan count", ok: true, detail: String(plans) });
    const orgs = await prisma.organization.count();
    steps.push({ step: "organization count", ok: true, detail: String(orgs) });
  } catch (e) {
    steps.push({ step: "prisma query", ok: false, detail: errText(e) });
  }

  return NextResponse.json({ env, steps });
}
