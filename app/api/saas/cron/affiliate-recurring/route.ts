import { NextRequest, NextResponse } from "next/server";
import { initSaasDb } from "@/lib/saas/init";
import { advanceDeferredCommissions } from "@/lib/saas/recurringCommissions";
import { secretsMatch } from "@/lib/saas/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !secretsMatch(apiKey, process.env.AFFILIATE_CRON_KEY ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await advanceDeferredCommissions(100);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron/affiliate-recurring] advanceDeferredCommissions failed:", e);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
