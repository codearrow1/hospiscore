import { NextRequest, NextResponse } from "next/server";
import { initSaasDb } from "@/lib/saas/init";
import { advanceDeferredCommissions } from "@/lib/saas/recurringCommissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await initSaasDb().catch(() => {});

  // Authenticate via x-api-key header (for Vercel cron or internal calls)
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.AFFILIATE_CRON_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await advanceDeferredCommissions(100);
  return NextResponse.json(result);
}
