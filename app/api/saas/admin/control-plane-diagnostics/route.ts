import { NextResponse } from "next/server";
import { requireMarketingUser } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { getCurrentUser } from "@/lib/sessionCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Step = { step: string; ok: boolean; ms?: number; detail?: string };

function errText(e: unknown): string {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return msg.slice(0, 500);
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ step: Step; value?: T }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { step: { step: label, ok: true, ms: Date.now() - t0 }, value };
  } catch (e) {
    return { step: { step: label, ok: false, ms: Date.now() - t0, detail: errText(e) } };
  }
}

/**
 * GET /api/saas/admin/control-plane-diagnostics
 *
 * Super-admin-only endpoint that tests each Command Center component
 * independently. Returns structured JSON with per-step status, timing,
 * and error details. Use this to identify the exact failure point in
 * production without broad catch blocks or error hiding.
 */
export async function GET() {
  const steps: Step[] = [];

  // 1. Auth gate
  const auth = await timed("AUTH (requireMarketingUser)", () => requireMarketingUser());
  steps.push(auth.step);
  if (!auth.value?.ok) {
    return NextResponse.json({ ok: false, steps, note: "Auth failed — remaining steps skipped" }, { status: 401 });
  }
  const user = auth.value.user;

  // 2. RBAC
  const perms = [
    "CUSTOMER_VIEW",
    "SUBSCRIPTION_VIEW",
    "BILLING_VIEW",
    "SUPPORT_VIEW",
    "PLAN_VIEW",
    "CUSTOMER_MANAGE",
    "SYSTEM_SETTINGS_MANAGE",
  ] as const;
  const rbacDetail = perms.filter((p) => hasSaasPerm(user, p)).join(", ") || "(none)";
  steps.push({ step: "RBAC (hasSaasPerm)", ok: true, detail: rbacDetail });

  // 2b. getCurrentUser() — the exact call /saas/organizations/page.tsx makes
  const currentUser = await timed("AUTH (getCurrentUser, orgs page path)", () => getCurrentUser());
  steps.push(currentUser.step);
  if (currentUser.step.ok) {
    const cu = currentUser.value;
    steps.push({
      step: "getCurrentUser resolved",
      ok: cu != null,
      detail: cu ? `${cu.id} / ${cu.email}` : "NULL (would redirect on page)",
    });
  }

  // 2c. Layout gate functions (canAccess + roleFor)
  const layoutGate = await timed("LAYOUT (canAccess + roleFor)", async () => {
    const { canAccess, roleFor } = await import("@/lib/marketing/roles");
    const { hasSaasPerm: hsp } = await import("@/lib/saas/roles");
    const navPerms = ["CUSTOMER_VIEW", "SUBSCRIPTION_VIEW", "PLAN_VIEW", "SYSTEM_SETTINGS_MANAGE", "BILLING_VIEW", "SUPPORT_VIEW"];
    return {
      canAccess: canAccess(user),
      role: roleFor(user) ?? "none",
      navShown: navPerms.filter((p) => hsp(user, p as never)).length,
    };
  });
  steps.push(layoutGate.step);
  if (layoutGate.step.ok) {
    steps.push({ step: "layout gate detail", ok: true, detail: JSON.stringify(layoutGate.value) });
  }

  // 3. initSaasDb
  const init = await timed("DB INIT (initSaasDb)", async () => {
    const { initSaasDb } = await import("@/lib/saas/init");
    await initSaasDb();
  });
  steps.push(init.step);

  // 3b. seedDefaultPlans (runs on /saas before queries)
  const seed = await timed("DB SEED (seedDefaultPlans)", async () => {
    const { seedDefaultPlans } = await import("@/lib/saas/plans");
    await seedDefaultPlans();
  });
  steps.push(seed.step);

  // 4. Each Command Center data query individually
  const q1 = await timed("QUERY (saasMetrics)", async () => {
    const { saasMetrics } = await import("@/lib/saas/metrics");
    return saasMetrics(30);
  });
  steps.push(q1.step);

  const q2 = await timed("QUERY (saasOpsSummary)", async () => {
    const { saasOpsSummary } = await import("@/lib/saas/metrics");
    return saasOpsSummary();
  });
  steps.push(q2.step);

  const q3 = await timed("QUERY (listHealth)", async () => {
    const { listHealth } = await import("@/lib/saas/health");
    return listHealth({});
  });
  steps.push(q3.step);

  const q4 = await timed("QUERY (revenueByCountry)", async () => {
    const { revenueByCountry } = await import("@/lib/saas/analytics");
    return revenueByCountry();
  });
  steps.push(q4.step);

  const q5 = await timed("QUERY (churnCohort)", async () => {
    const { churnCohort } = await import("@/lib/saas/analytics");
    return churnCohort(6);
  });
  steps.push(q5.step);

  const allOk = steps.every((s) => s.ok);

  return NextResponse.json({
    ok: allOk,
    user: { id: user.id, email: user.email },
    steps,
    timestamp: new Date().toISOString(),
  });
}
