import { NextRequest, NextResponse } from "next/server";
import { originAllowed, clientIp, rateLimit } from "@/lib/marketing/guard";
import { createPasswordReset } from "@/lib/accounts";
import { sendMail } from "@/lib/mailer";

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
  try {
    await sendMail({
      to: email,
      subject: "Reset your HospiOS password",
      html: `<p>You requested a password reset. Click the link below to set a new password. This link expires in 30 minutes.</p>
<p><a href="${resetUrl}">Reset password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
    });
  } catch {
    // Mail delivery failure is non-fatal — the token is stored server-side.
  }
  // Always respond identically regardless of mail delivery outcome.
  return NextResponse.json(generic);
}
