import { NextRequest, NextResponse } from "next/server";
import { reconcileWebhook, WebhookReconcileError } from "@/lib/saas/payments/reconcile";
import { getProviderConfig } from "@/lib/saas/payments/store";
import { recordProviderOutcome } from "@/lib/saas/payments/health";
import { GatewayError } from "@/lib/saas/adapters/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook/[provider]
 * Provider webhook endpoint. NO session auth — authenticity is established by
 * per-provider signature verification. Server confirmation is the ONLY path
 * that settles an invoice (browser success is never authoritative).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const providerId = String(provider).toLowerCase();
  const cfg = await getProviderConfig(providerId);
  if (!cfg) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await req.text();
  const headers: Record<string, string | string[]> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  try {
    const result = await reconcileWebhook({ providerId, rawBody, headers, ip: req.headers.get("x-forwarded-for") ?? undefined });
    await recordProviderOutcome({ providerId, ok: true });
    return NextResponse.json({ received: true, status: result.status, handled: result.handled }, { status: 200 });
  } catch (e) {
    if (e instanceof WebhookReconcileError) {
      await recordProviderOutcome({ providerId, ok: false, error: e.message });
      return NextResponse.json({ error: "Reconciliation failed" }, { status: 400 });
    }
    if (e instanceof GatewayError) {
      // Signature/verification failures are not provider-health events — they
      // are bad requests (or tampering). Do not report them as provider outages.
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }
    console.error("[webhook] reconciliation error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
