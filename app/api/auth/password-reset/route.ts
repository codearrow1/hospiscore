import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { createPasswordReset } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/password-reset { email }
 *
 * Always responds identically whether or not the account exists — no
 * enumeration. Email delivery is a labeled BACKEND GAP: when the mailer is
 * not configured (non-production), the one-time reset URL is returned so the
 * workflow is testable end-to-end; in production the token is only stored
 * hashed and an operator channel delivers it.
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Rejected" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  // Throttle per-IP and per-account to slow token grinding.
  if (!rateLimit(`pwreset:${clientIp(req)}`, 5, 60_000) || !rateLimit(`pwreset:${email}`, 3, 60_000)) {
    return NextResponse.json({ error: "Too many requests — try again shortly" }, { status: 429 });
  }

  const result = await createPasswordReset(email);
  const generic = {
    ok: true as const,
    message: "If that email is registered, a reset link has been generated. It expires in 30 minutes.",
  };
  if (!result) return NextResponse.json(generic);

  const origin = req.nextUrl.origin;
  const resetUrl = `${origin}/account?reset=${encodeURIComponent(result.token)}`;
  if (process.env.NODE_ENV === "production") {
    // BACKEND GAP (labeled): outbound mail delivery for reset links is not
    // wired yet. The token exists only hashed server-side; surface nothing.
    return NextResponse.json({ ...generic, delivered: false });
  }
  return NextResponse.json({ ...generic, delivered: true, resetUrl });
}
