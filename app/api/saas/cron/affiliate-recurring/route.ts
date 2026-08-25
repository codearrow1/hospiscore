import { NextResponse } from "next/server";
import { initSaasDb } from "@/lib/saas/init";
import { advanceDeferredCommissions } from "@/lib/saas/recurringCommissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await initSaasDb().catch(() => {});
  const result = await advanceDeferredCommissions(100);
  return NextResponse.json(result);
}
