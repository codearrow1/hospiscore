import { NextRequest, NextResponse } from "next/server";
import { originAllowed, rateLimit } from "@/lib/marketing/guard";
import { requireCustomerOrg } from "@/lib/saas/portalAccess";
import { prisma } from "@/lib/prisma";
import { verifyCode, isVerifyMethod } from "@/lib/saas/propertyVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/customer/claims/[id]/verify { method, code, phone? } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  const access = await requireCustomerOrg();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await ctx.params;
  if (!rateLimit(`claimverify:${access.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const claim = await prisma.propertyClaim.findFirst({
    where: { id, organizationId: access.org.organizationId },
    select: { id: true, status: true },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found for your organization" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const method = body.method;
  if (!isVerifyMethod(method)) return NextResponse.json({ error: "method must be phone_otp|email" }, { status: 400 });
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const result = await verifyCode({
    claimId: claim.id,
    method,
    code,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    byUser: access.user.email,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
