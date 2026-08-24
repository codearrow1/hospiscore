import { NextRequest, NextResponse } from "next/server";
import { requireSaasAccess, originAllowed, clientIp } from "@/lib/marketing/guard";
import { hasSaasPerm } from "@/lib/saas/roles";
import { voidInvoice } from "@/lib/saas/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/saas/invoices/[id]/void — BILLING_MANAGE only.
 * Voids an unsettled invoice and closes any open dunning case for it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSaasAccess();
  if (!guard.ok) return guard.response;
  if (!hasSaasPerm(guard.user, "BILLING_MANAGE")) return NextResponse.json({ error: "BILLING_MANAGE required" }, { status: 403 });
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const { id } = await params;
  try {
    const invoice = await voidInvoice(id, guard.user.email, clientIp(req));
    return NextResponse.json({ invoice });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Void failed" }, { status: 400 });
  }
}
